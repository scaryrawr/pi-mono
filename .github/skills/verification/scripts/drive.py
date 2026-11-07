#!/usr/bin/env python3
"""Run one isolated, package-specific Pi journey and preserve its evidence."""

import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import errno
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import queue
import re
import shutil
import subprocess
import tempfile
import threading
import time


ROOT = Path(__file__).resolve().parents[4]
PACKAGES = ("agent-plugins", "copilot", "digivolve", "local-llm", "sandbox", "webfetch")


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def require(condition, message):
    if not condition:
        raise AssertionError(message)


class Rpc:
    def __init__(self, command, workspace, environment, evidence, label):
        self.argv = command
        self.workspace = workspace
        self.environment = environment
        self.evidence = evidence
        self.events = queue.Queue()
        self.sequence = 0
        self.log = (evidence / f"{label}.jsonl").open("w")
        self.log_lock = threading.Lock()
        self.stderr = (evidence / f"{label}.stderr.txt").open("w")
        self.process = None
        self.threads = []
        self.record("launch", {"argv": command, "cwd": str(workspace),
                               "agentDir": environment["PI_CODING_AGENT_DIR"]})
        try:
            self.process = subprocess.Popen(command, cwd=workspace, env=environment,
                                            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                            stderr=self.stderr)
            reader = threading.Thread(target=self.read, daemon=True)
            reader.start()
            self.threads.append(reader)
        except BaseException:
            self.close()
            raise

    def record(self, direction, record):
        with self.log_lock:
            self.log.write(json.dumps({"direction": direction, "record": record}) + "\n")
            self.log.flush()

    def read(self):
        try:
            for line in self.process.stdout:
                record = json.loads(line)
                self.record("receive", record)
                self.events.put(record)
        except Exception as error:
            self.events.put(error)
        finally:
            self.events.put(RuntimeError("Pi closed stdout; inspect stderr evidence"))

    def send(self, record):
        self.record("send", record)
        self.process.stdin.write(json.dumps(record).encode() + b"\n")
        self.process.stdin.flush()

    def request(self, command, timeout=30, dialogs=(), events=None):
        answers = iter(dialogs)
        self.sequence += 1
        request_id = str(self.sequence)
        self.send({**command, "id": request_id})
        notifications = []
        deadline = time.monotonic() + timeout
        while True:
            record = self.next(deadline)
            if events is not None and record.get("type") != "response":
                events.append(record)
            if record.get("type") == "extension_ui_request":
                if record.get("method") == "notify":
                    notifications.append(record["message"])
                elif record.get("method") in ("select", "input", "confirm", "editor"):
                    answer = next(answers, None)
                    if answer is None or answer["method"] != record["method"] or answer["title"] != record["title"]:
                        self.send({"type": "extension_ui_response", "id": record["id"],
                                   "cancelled": True})
                        raise AssertionError("Unexpected dialog; cancelled, not verified")
                    response = {key: value for key, value in answer.items() if key not in ("method", "title")}
                    self.send({"type": "extension_ui_response", "id": record["id"], **response})
            if record.get("type") == "response" and record.get("id") == request_id:
                require(record.get("success") is True, str(record))
                return record.get("data", {}), notifications

    def next(self, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Pi response deadline expired")
        try:
            record = self.events.get(timeout=remaining)
        except queue.Empty as error:
            raise TimeoutError("Pi response deadline expired") from error
        if isinstance(record, Exception):
            raise record
        return record

    def command(self, text, dialogs=()):
        data, notifications = self.request({"type": "prompt", "message": text}, dialogs=dialogs)
        require(data.get("disposition") == "handled", f"Command not handled: {text}")
        return "\n".join(notifications)

    def restart(self, label):
        """Restart this owned child with the same scratch config and a new log label."""
        command, workspace, environment, evidence = self.argv, self.workspace, self.environment, self.evidence
        self.close()
        self.__init__(command, workspace, environment, evidence, label)

    def close(self):
        if self.process is not None:
            try:
                self.process.stdin.close()
            except BrokenPipeError:
                pass
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
            for thread in self.threads:
                thread.join(timeout=5)
            self.process.stdout.close()
            self.record("exit", {"code": self.process.returncode})
        self.stderr.close()
        self.log.close()


def pi_command(package, live_model=None):
    command = ["pi", "--no-session", "--no-extensions", "--no-skills",
               "--no-prompt-templates", "--no-context-files", "--no-approve",
               "-e", str(ROOT / "packages" / package)]
    if live_model:
        command += ["--model", live_model, "--tools", "webfetch"]
    else:
        command += ["--offline"]
    if package == "agent-plugins":
        command += ["-e", "builtin:mcp", "-e", "builtin:tool-search"]
    return command


def seed(package, agent, workspace):
    if package == "agent-plugins":
        plugin = workspace / "plugin"
        skill = plugin / "skills" / "verify-demo"
        prompt = plugin / "com.scaryrawr.pi" / "prompts"
        skill.mkdir(parents=True)
        prompt.mkdir(parents=True)
        save(plugin / "plugin.json", {"name": "verify-demo"})
        (skill / "SKILL.md").write_text(
            "---\nname: verify-demo\ndescription: Synthetic verification skill.\n---\n"
            "Reply with verification-demo.\n")
        (prompt / "verify-prompt.md").write_text("Reply with verification-prompt.\n")
        save(agent / "pi-agent-plugins.json", {"plugins": [str(plugin)]})
    elif package == "copilot":
        save(agent / "copilot-models.json", {
            "cachedAt": datetime.now(timezone.utc).isoformat(),
            "content": {"data": [{"id": "verify-cache-model", "name": "Verification cache model",
                                   "model_picker_enabled": True,
                                   "supported_endpoints": ["/chat/completions"],
                                   "capabilities": {"supports": {"tool_calls": True},
                                                    "limits": {"max_context_window_tokens": 8192,
                                                               "max_output_tokens": 1024}}}]}})
    elif package == "local-llm":
        save(agent / "pi-local-llm.json", {"providers": {
            name: {"enabled": False, "baseUrl": "http://127.0.0.1:1",
                   "apiKey": "verification-not-a-secret"}
            for name in ("ollama", "osaurus", "lmstudio", "omlx", "geniex")}})


@contextmanager
def controlled_session(package, evidence, approve=False, prepare=None):
    """Yield (client, agent directory, workspace) for an additional offline RPC journey."""
    evidence = Path(evidence).resolve()
    evidence.mkdir(parents=True, exist_ok=False)
    temporary = None
    try:
        with tempfile.TemporaryDirectory(prefix=f"verify-{package}-") as temporary:
            agent = Path(temporary) / "agent"
            workspace = Path(temporary) / "workspace"
            agent.mkdir()
            workspace.mkdir()
            environment = {key: value for key, value in os.environ.items()
                           if not key.startswith("PI_") and not any(
                               word in key.upper() for word in ("TOKEN", "API_KEY", "SECRET"))}
            environment["PI_CODING_AGENT_DIR"] = str(agent)
            seed(package, agent, workspace)
            if prepare:
                prepare(agent, workspace)
            save(evidence / "seed.json", {path.name: path.read_text()
                                          for path in agent.glob("*.json")
                                          if path.name != "auth.json" and package != "copilot"})
            command = pi_command(package)
            if approve:
                command.remove("--no-approve")
                command.append("--approve")
            client = Rpc(command + ["--mode", "rpc"], workspace, environment, evidence, "drive")
            try:
                doctor(client, package, evidence)
                yield client, agent, workspace
            finally:
                client.close()
    finally:
        save(evidence / "cleanup.json", {"scratchRemoved": temporary is None or not Path(temporary).exists()})


def doctor(client, package, evidence):
    state, _ = client.request({"type": "get_state"})
    require(state.get("isStreaming") is False, "Pi is not idle")
    commands, _ = client.request({"type": "get_commands"})
    names = {item["name"] for item in commands["commands"]}
    expected = {"agent-plugins": "marketplaces", "digivolve": "digivolve",
                "local-llm": "local-ai", "sandbox": "sandbox"}.get(package)
    if expected:
        require(expected in names, f"Missing /{expected}")
    save(evidence / "doctor.json", {"state": state, "commands": commands})


def journey(client, package, agent, evidence):
    if package == "agent-plugins":
        commands, _ = client.request({"type": "get_commands"})
        names = {item["name"] for item in commands["commands"]}
        require("skill:verify-demo" in names, "Portable skill was not discovered")
        require("verify-prompt" in names, "Pi prompt was not discovered")
        save(evidence / "resources.json", commands)
    elif package == "copilot":
        models, _ = client.request({"type": "get_available_models"})
        model = next((m for m in models["models"]
                      if m["provider"] == "github-copilot" and m["id"] == "verify-cache-model"), None)
        require(model is not None, "Warm cache model is absent")
        require(model["contextWindow"] == 8192 and model["maxTokens"] == 1024,
                "Cache limits were not projected")
        client.request({"type": "set_model", "provider": "github-copilot",
                        "modelId": "verify-cache-model"})
        state, _ = client.request({"type": "get_state"})
        require(state["model"]["id"] == "verify-cache-model", "Model selection did not stick")
        save(evidence / "models.json", models)
    elif package == "digivolve":
        require(not (agent / "pi-digivolve.json").exists(), "Startup wrote settings")
        require("automatic reflection disabled" in client.command("/digivolve off"),
                "Missing disabled notification")
        require(json.loads((agent / "pi-digivolve.json").read_text())["enabled"] is False,
                "Disabled preference was not saved")
        require("auto=off" in client.command("/digivolve status"), "Status is not off")
        save(evidence / "disabled.json", json.loads((agent / "pi-digivolve.json").read_text()))
    elif package == "sandbox":
        config = agent / "pi-mxc.json"
        require(not config.exists(), "Startup wrote sandbox config")
        client.command("/sandbox off")
        status = client.command("/sandbox status")
        policy = json.loads(status.split("Effective policy:\n", 1)[1])
        require(policy["enabled"] is False, "Session opt-out was not applied")
        require(not config.exists(), "Session opt-out persisted")
        client.command("/sandbox init")
        saved = json.loads(config.read_text())
        require(saved["enabled"] is True, "Init copied session-only opt-out")
        client.request({"type": "new_session"})
        status = client.command("/sandbox status")
        require(json.loads(status.split("Effective policy:\n", 1)[1])["enabled"] is True,
                "Session switch retained override")
        save(evidence / "saved-policy.json", saved)
    elif package == "local-llm":
        notification = client.command("/local-ai")
        require("requires interactive TUI mode" in notification, "RPC mode guard missing")


def preferences_pty(command, workspace, environment, agent, evidence):
    # Unix PTY only. RPC custom() cannot drive /local-ai.
    import fcntl
    import pty
    import select
    import struct
    import termios

    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 36, 120, 0, 0))
    process = None
    transcript = (evidence / "preferences.pty.bin").open("wb")
    actions = (evidence / "preferences.actions.jsonl").open("w")
    text = bytearray()

    def wait_for(expected):
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            ready, _, _ = select.select([master], [], [], 0.2)
            if ready:
                try:
                    chunk = os.read(master, 65536)
                except OSError as error:
                    if error.errno == errno.EIO:
                        raise RuntimeError("Pi PTY closed; inspect terminal evidence") from error
                    raise
                require(bool(chunk), "Pi PTY closed")
                transcript.write(chunk)
                transcript.flush()
                text.extend(chunk)
                plain = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", text.decode(errors="replace"))
                if expected in plain:
                    text.clear()
                    return
            if process.poll() is not None:
                raise RuntimeError("Pi exited before the requested TUI state")
        raise TimeoutError(f"TUI did not show {expected!r}")

    def send(data, label):
        actions.write(json.dumps({"action": label, "bytes": data.hex()}) + "\n")
        actions.flush()
        os.write(master, data)

    before = (agent / "pi-local-llm.json").read_text()
    try:
        process = subprocess.Popen(command + ["--tui-mode", "regular", "--verbose"], cwd=workspace,
                                   env={**environment, "TERM": "xterm-256color"},
                                   stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
        os.close(slave)
        slave = None
        # Startup identity, followed by a command, proves the TUI is usable.
        wait_for("pi v")
        send(b"/local-ai\r", "open /local-ai")
        wait_for("Local AI providers")
        send(b" ", "toggle focused Ollama row")
        send(b"\x1b", "cancel with Escape")
        wait_for("cancelled, no changes saved")
        require((agent / "pi-local-llm.json").read_text() == before, "Cancel changed config")
        send(b"/local-ai\r", "reopen /local-ai")
        wait_for("Local AI providers")
        send(b" \r", "toggle Ollama and save with Enter")
        wait_for("changes apply to providers registered at next pi start")
        config = json.loads((agent / "pi-local-llm.json").read_text())
        require(config["providers"]["ollama"]["enabled"] is True, "Save did not enable Ollama")
        for name, settings in config["providers"].items():
            require(settings["baseUrl"] == "http://127.0.0.1:1", "Save lost server address")
            require(settings["apiKey"] == "verification-not-a-secret", "Save lost API key")
            if name != "ollama":
                require(settings["enabled"] is False, "Save toggled an unrelated provider")
        save(evidence / "saved-providers.json", config)
    finally:
        if process is not None:
            if process.poll() is None:
                os.write(master, b"\x03")
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            actions.write(json.dumps({"exitCode": process.returncode}) + "\n")
        if slave is not None:
            os.close(slave)
        os.close(master)
        transcript.close()
        actions.close()


IMAGE = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==")
WEBFETCH_PATHS = {"html": "/page", "image": "/image", "truncation": "/long", "download-error": "/oversize"}


class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.requests.append(self.path)
        content_type = "text/html; charset=utf-8"
        if self.path == "/page":
            body = b"<h1>Verification page</h1><p>Read through webfetch.</p>"
        elif self.path == "/image":
            body, content_type = IMAGE, "image/png"
        elif self.path == "/long":
            body = "\n".join(f"line-{line}" for line in range(2100)).encode()
            content_type = "text/plain"
        elif self.path == "/oversize":
            body = b"x" * (5 * 1024 * 1024 + 1)
            content_type = "text/plain"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # The oversized-response journey should cancel the response.
            pass

    def log_message(self, format_string, *args):
        self.server.evidence_log.write((format_string % args) + "\n")
        self.server.evidence_log.flush()


def webfetch(client, evidence, fixture, case):
    url = f"http://127.0.0.1:{fixture.server_port}{WEBFETCH_PATHS[case]}"
    early_events = []
    data, _ = client.request({"type": "prompt", "message":
                              f"Call webfetch exactly once with {url}. Do not use other tools. "
                              "Then briefly describe the returned result, including any error."}, events=early_events)
    require(data.get("disposition") == "started", "Model run was not started")
    deadline = time.monotonic() + 120
    results = []
    calls = []
    buffered = iter(early_events)
    while True:
        record = next(buffered, None)
        if record is None:
            record = client.next(deadline)
        if record.get("type") == "tool_execution_start" and record.get("toolName") == "webfetch":
            calls.append(record.get("args"))
        if record.get("type") == "tool_execution_end" and record.get("toolName") == "webfetch":
            require(not record.get("isError"), "webfetch reported an error")
            results.append(record["result"])
        if record.get("type") == "agent_settled":
            break
    require(len(results) == 1, "Expected exactly one real webfetch call")
    require(calls == [{"url": url}], "webfetch did not use the exact fixture URL")
    require(fixture.requests == [WEBFETCH_PATHS[case]], "HTTP requests do not match the tool action")
    content = results[0]["content"]
    text = "\n".join(block.get("text", "") for block in content)
    if case == "html":
        require("# Verification page" in text, "HTML heading was not converted")
    elif case == "image":
        image = next((block for block in content if block.get("type") == "image"), None)
        require(image is not None and image["mimeType"] == "image/png", "Missing PNG ImageContent")
        decoded = base64.b64decode(image["data"], validate=True)
        require(decoded == IMAGE, "Image bytes changed during fetching")
        (evidence / "image.png").write_bytes(decoded)
    elif case == "truncation":
        truncation = results[0].get("details", {}).get("truncation")
        require(truncation is not None and truncation["truncatedBy"] == "lines" and
                truncation["outputLines"] == 2000 and truncation["totalLines"] == 2100,
                "Text line truncation metadata is incorrect")
        require("line-1999" in text and "line-2000" not in text, "Text truncation boundary is incorrect")
    elif case == "download-error":
        require("Error: Response exceeds the 5 MiB download limit." in text,
                "Oversized download was not reported as typed tool output")
    messages, _ = client.request({"type": "get_messages"})
    require(not any(message.get("role") == "assistant" and message.get("stopReason") == "error"
                    for message in messages["messages"]), "Provider failed after tool execution")
    save(evidence / "webfetch-result.json", results[0])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", choices=PACKAGES)
    parser.add_argument("--evidence", type=Path, required=True, help="New directory, outside scratch state")
    parser.add_argument("--model", help="Explicit live model for webfetch; may incur provider charges")
    parser.add_argument("--webfetch-case", choices=WEBFETCH_PATHS, default="html")
    parser.add_argument("--auth-file", type=Path, help="Explicitly approved dedicated verification auth.json")
    args = parser.parse_args()
    require(args.package == "webfetch" or not (args.model or args.auth_file),
            "Live credentials are accepted only for the webfetch journey")
    evidence = args.evidence.resolve()
    evidence.mkdir(parents=True, exist_ok=False)
    result = {"package": args.package, "feature": {
        "agent-plugins": "resources", "copilot": "cached-models", "digivolve": "preferences",
        "local-llm": "preferences", "sandbox": "policy", "webfetch": args.webfetch_case}[args.package],
        "status": "failed"}
    fixture = None
    fixture_thread = None
    fixture_log = None
    scratch = None
    try:
        with tempfile.TemporaryDirectory(prefix=f"verify-{args.package}-") as temporary:
            scratch = Path(temporary)
            agent = scratch / "agent"
            workspace = scratch / "workspace"
            agent.mkdir()
            workspace.mkdir()
            environment = {key: value for key, value in os.environ.items()
                           if not key.startswith("PI_") and
                           (args.package == "webfetch" or not any(
                               word in key.upper() for word in ("TOKEN", "API_KEY", "SECRET")))}
            environment["PI_CODING_AGENT_DIR"] = str(agent)
            seed(args.package, agent, workspace)
            save(evidence / "seed.json", {path.name: json.loads(path.read_text())
                                          for path in agent.glob("*.json")})
            if args.auth_file:
                shutil.copyfile(args.auth_file, agent / "auth.json")
                (agent / "auth.json").chmod(0o600)
            with (evidence / "version.txt").open("w") as output:
                version = subprocess.run(["pi", "--version"], env=environment, cwd=workspace,
                                         stdout=output, stderr=subprocess.STDOUT, timeout=20)
            require(version.returncode == 0, "Doctor failed: pi --version; inspect version.txt")
            if args.package == "webfetch":
                require(args.model is not None, "webfetch requires --model and approved credentials")
                fixture_log = (evidence / "http-requests.txt").open("w")
                fixture = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
                fixture.daemon_threads = True
                fixture.requests = []
                fixture.evidence_log = fixture_log
                fixture_thread = threading.Thread(target=fixture.serve_forever, daemon=True)
                fixture_thread.start()
                save(evidence / "fixture.json", {"url": f"http://127.0.0.1:{fixture.server_port}{WEBFETCH_PATHS[args.webfetch_case]}"})
            command = pi_command(args.package, args.model)
            client = Rpc(command + ["--mode", "rpc"], workspace, environment, evidence, "drive")
            try:
                doctor(client, args.package, evidence)
                if args.package == "webfetch":
                    webfetch(client, evidence, fixture, args.webfetch_case)
                else:
                    journey(client, args.package, agent, evidence)
            finally:
                client.close()
            if args.package == "digivolve":
                client = Rpc(command + ["--mode", "rpc"], workspace, environment, evidence, "restart")
                try:
                    doctor(client, args.package, evidence)
                    require("auto=off" in client.command("/digivolve status"), "Restart lost setting")
                    client.command("/digivolve on")
                    require(json.loads((agent / "pi-digivolve.json").read_text())["enabled"] is True,
                            "Enable did not persist")
                    messages, _ = client.request({"type": "get_messages"})
                    require(messages["messages"] == [], "Preference commands entered conversation history")
                finally:
                    client.close()
            if args.package == "local-llm":
                preferences_pty(command, workspace, environment, agent, evidence)
            result["status"] = "passed"
    except Exception as error:
        result["error"] = str(error)
    finally:
        if fixture:
            fixture.shutdown()
            fixture.server_close()
            fixture_thread.join(timeout=5)
        if fixture_log:
            fixture_log.close()
        result["scratchRemoved"] = scratch is None or not scratch.exists()
        save(evidence / "result.json", result)
    print(json.dumps(result))
    return 0 if result["status"] == "passed" and result["scratchRemoved"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

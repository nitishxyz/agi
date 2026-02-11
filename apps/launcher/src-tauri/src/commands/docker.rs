use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ContainerInfo {
    pub name: String,
    pub status: String,
    pub running: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ContainerCreateOpts {
    pub name: String,
    pub repo_url: String,
    pub repo_dir: String,
    pub encrypted_key: String,
    pub password: String,
    pub git_name: String,
    pub git_email: String,
    pub api_port: u16,
    pub dev_ports: Vec<u16>,
    pub image: String,
    #[serde(default)]
    pub use_personal_ssh: bool,
    #[serde(default)]
    pub ssh_key_name: String,
    #[serde(default)]
    pub ssh_passphrase: String,
}

#[cfg(unix)]
mod unix_impl {
    use super::*;
    use http_body_util::{BodyExt, Full};
    use hyper::body::Bytes;
    use hyper::Request;
    use hyper_util::client::legacy::Client;
    use hyper_util::rt::{TokioExecutor, TokioIo};
    use std::path::PathBuf;

    fn find_socket() -> PathBuf {
        let candidates: Vec<PathBuf> = vec![
            dirs::home_dir()
                .map(|h| h.join(".docker/run/docker.sock"))
                .unwrap_or_default(),
            PathBuf::from("/var/run/docker.sock"),
            dirs::home_dir()
                .map(|h| {
                    h.join("Library/Containers/com.docker.docker/Data/docker.raw.sock")
                })
                .unwrap_or_default(),
        ];
        for p in &candidates {
            if p.exists() {
                return p.clone();
            }
        }
        PathBuf::from("/var/run/docker.sock")
    }

    #[derive(Clone)]
    struct UnixConnector {
        socket_path: PathBuf,
    }

    impl tower::Service<hyper::Uri> for UnixConnector {
        type Response = TokioIo<tokio::net::UnixStream>;
        type Error = std::io::Error;
        type Future = std::pin::Pin<
            Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>,
        >;

        fn poll_ready(
            &mut self,
            _cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), Self::Error>> {
            std::task::Poll::Ready(Ok(()))
        }

        fn call(&mut self, _uri: hyper::Uri) -> Self::Future {
            let path = self.socket_path.clone();
            Box::pin(async move {
                let stream = tokio::net::UnixStream::connect(&path).await?;
                Ok(TokioIo::new(stream))
            })
        }
    }

    fn make_client() -> Client<UnixConnector, Full<Bytes>> {
        let connector = UnixConnector {
            socket_path: find_socket(),
        };
        Client::builder(TokioExecutor::new()).build(connector)
    }

    fn docker_uri(path: &str) -> hyper::Uri {
        let encoded = path
            .replace('{', "%7B")
            .replace('}', "%7D")
            .replace('[', "%5B")
            .replace(']', "%5D")
            .replace('"', "%22");
        hyper::Uri::builder()
            .scheme("http")
            .authority("localhost")
            .path_and_query(encoded)
            .build()
            .expect("valid docker URI")
    }

    pub async fn docker_get(path: &str) -> Result<String, String> {
        let client = make_client();
        let uri = docker_uri(path);
        let req = Request::builder()
            .method("GET")
            .uri(uri)
            .body(Full::new(Bytes::new()))
            .map_err(|e| format!("Build request failed: {}", e))?;
        let response = client
            .request(req)
            .await
            .map_err(|e| format!("Docker request failed: {}", e))?;
        let body = response
            .into_body()
            .collect()
            .await
            .map_err(|e| format!("Read body failed: {}", e))?
            .to_bytes();
        Ok(String::from_utf8_lossy(&body).into_owned())
    }

    pub async fn docker_post(path: &str, json_body: Option<serde_json::Value>) -> Result<String, String> {
        let client = make_client();
        let uri = docker_uri(path);

        let body = match json_body {
            Some(val) => Full::new(Bytes::from(serde_json::to_vec(&val).unwrap())),
            None => Full::new(Bytes::new()),
        };

        let req = Request::builder()
            .method("POST")
            .uri(uri)
            .header("Content-Type", "application/json")
            .body(body)
            .map_err(|e| format!("Build request failed: {}", e))?;

        let response = client
            .request(req)
            .await
            .map_err(|e| format!("Docker request failed: {}", e))?;

        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| format!("Read body failed: {}", e))?
            .to_bytes();
        let body_str = String::from_utf8_lossy(&body_bytes).to_string();

        if !status.is_success() && !status.is_redirection() {
            return Err(format!("Docker API error ({}): {}", status, body_str));
        }
        Ok(body_str)
    }

    pub async fn docker_delete(path: &str) -> Result<String, String> {
        let client = make_client();
        let uri = docker_uri(path);

        let req = Request::builder()
            .method("DELETE")
            .uri(uri)
            .body(Full::new(Bytes::new()))
            .map_err(|e| format!("Build request failed: {}", e))?;

        let response = client
            .request(req)
            .await
            .map_err(|e| format!("Docker request failed: {}", e))?;

        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| format!("Read body failed: {}", e))?
            .to_bytes();
        let body_str = String::from_utf8_lossy(&body_bytes).to_string();

        if !status.is_success() && !status.is_redirection() {
            return Err(format!("Docker API error ({}): {}", status, body_str));
        }
        Ok(body_str)
    }
}

#[cfg(unix)]
use unix_impl::{docker_get, docker_post, docker_delete};

#[cfg(windows)]
mod windows_impl {
    use http_body_util::{BodyExt, Full};
    use hyper::body::Bytes;
    use hyper::Request;
    use hyper_util::client::legacy::Client;
    use hyper_util::rt::TokioExecutor;

    use std::sync::OnceLock;

    static DOCKER_HOST: OnceLock<String> = OnceLock::new();

    async fn probe_host(host: &str) -> bool {
        let client = Client::builder(TokioExecutor::new()).build_http::<Full<Bytes>>();
        let uri = format!("{}/_ping", host);
        let Ok(uri) = uri.parse::<hyper::Uri>() else { return false };
        let Ok(req) = Request::builder()
            .method("GET")
            .uri(uri)
            .body(Full::new(Bytes::new())) else { return false };
        client.request(req).await.is_ok()
    }

    pub async fn resolve_docker_host() -> String {
        if let Some(h) = DOCKER_HOST.get() {
            return h.clone();
        }

        if let Ok(env_host) = std::env::var("DOCKER_HOST") {
            let h = if env_host.starts_with("tcp://") {
                env_host.replace("tcp://", "http://")
            } else {
                env_host
            };
            let _ = DOCKER_HOST.set(h.clone());
            return h;
        }

        let candidates = [
            "http://localhost:2375",
            "http://127.0.0.1:2375",
            "http://localhost:2376",
        ];

        for c in &candidates {
            if probe_host(c).await {
                let _ = DOCKER_HOST.set(c.to_string());
                return c.to_string();
            }
        }

        let fallback = candidates[0].to_string();
        let _ = DOCKER_HOST.set(fallback.clone());
        fallback
    }

    fn docker_uri_with_host(host: &str, path: &str) -> String {
        let base = host.trim_end_matches('/');
        let encoded = path
            .replace('{', "%7B")
            .replace('}', "%7D")
            .replace('[', "%5B")
            .replace(']', "%5D")
            .replace('"', "%22");
        format!("{}{}", base, encoded)
    }

    fn make_client() -> Client<
        hyper_util::client::legacy::connect::HttpConnector,
        Full<Bytes>,
    > {
        Client::builder(TokioExecutor::new()).build_http()
    }

    pub async fn docker_get(path: &str) -> Result<String, String> {
        let host = resolve_docker_host().await;
        let client = make_client();
        let uri: hyper::Uri = docker_uri_with_host(&host, path)
            .parse()
            .map_err(|e| format!("Invalid URI: {}", e))?;
        let req = Request::builder()
            .method("GET")
            .uri(uri)
            .body(Full::new(Bytes::new()))
            .map_err(|e| format!("Build request failed: {}", e))?;
        let response = client
            .request(req)
            .await
            .map_err(|e| format!("Docker request failed (is Docker Desktop running with TCP enabled?): {}", e))?;
        let body = response
            .into_body()
            .collect()
            .await
            .map_err(|e| format!("Read body failed: {}", e))?
            .to_bytes();
        Ok(String::from_utf8_lossy(&body).into_owned())
    }

    pub async fn docker_post(path: &str, json_body: Option<serde_json::Value>) -> Result<String, String> {
        let host = resolve_docker_host().await;
        let client = make_client();
        let uri: hyper::Uri = docker_uri_with_host(&host, path)
            .parse()
            .map_err(|e| format!("Invalid URI: {}", e))?;
        let body = match json_body {
            Some(val) => Full::new(Bytes::from(serde_json::to_vec(&val).unwrap())),
            None => Full::new(Bytes::new()),
        };
        let req = Request::builder()
            .method("POST")
            .uri(uri)
            .header("Content-Type", "application/json")
            .body(body)
            .map_err(|e| format!("Build request failed: {}", e))?;
        let response = client
            .request(req)
            .await
            .map_err(|e| format!("Docker request failed (is Docker Desktop running with TCP enabled?): {}", e))?;
        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| format!("Read body failed: {}", e))?
            .to_bytes();
        let body_str = String::from_utf8_lossy(&body_bytes).to_string();
        if !status.is_success() && !status.is_redirection() {
            return Err(format!("Docker API error ({}): {}", status, body_str));
        }
        Ok(body_str)
    }

    pub async fn docker_delete(path: &str) -> Result<String, String> {
        let host = resolve_docker_host().await;
        let client = make_client();
        let uri: hyper::Uri = docker_uri_with_host(&host, path)
            .parse()
            .map_err(|e| format!("Invalid URI: {}", e))?;
        let req = Request::builder()
            .method("DELETE")
            .uri(uri)
            .body(Full::new(Bytes::new()))
            .map_err(|e| format!("Build request failed: {}", e))?;
        let response = client
            .request(req)
            .await
            .map_err(|e| format!("Docker request failed (is Docker Desktop running with TCP enabled?): {}", e))?;
        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| format!("Read body failed: {}", e))?
            .to_bytes();
        let body_str = String::from_utf8_lossy(&body_bytes).to_string();
        if !status.is_success() && !status.is_redirection() {
            return Err(format!("Docker API error ({}): {}", status, body_str));
        }
        Ok(body_str)
    }
}

#[cfg(windows)]
use windows_impl::{docker_get, docker_post, docker_delete};

#[tauri::command]
pub async fn docker_available() -> bool {
    docker_get("/_ping").await.is_ok()
}

#[tauri::command]
pub async fn container_exists(name: String) -> bool {
    docker_get(&format!(
        "/containers/json?all=true&filters={{\"name\":[\"^/{}$\"]}}", 
        name
    ))
    .await
    .map(|body| {
        !serde_json::from_str::<Vec<serde_json::Value>>(&body)
            .unwrap_or_default()
            .is_empty()
    })
    .unwrap_or(false)
}

#[tauri::command]
pub async fn container_running(name: String) -> bool {
    docker_get(&format!(
        "/containers/json?filters={{\"name\":[\"^/{}$\"]}}", 
        name
    ))
    .await
    .map(|body| {
        !serde_json::from_str::<Vec<serde_json::Value>>(&body)
            .unwrap_or_default()
            .is_empty()
    })
    .unwrap_or(false)
}

#[tauri::command]
pub async fn container_inspect(name: String) -> Result<ContainerInfo, String> {
    let body = docker_get(&format!("/containers/{}/json", name)).await?;
    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;

    let status = json["State"]["Status"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();
    let running = json["State"]["Running"].as_bool().unwrap_or(false);

    Ok(ContainerInfo {
        name,
        status,
        running,
    })
}

#[tauri::command]
pub async fn container_create(opts: ContainerCreateOpts) -> Result<String, String> {
    let _ = docker_post(&format!("/containers/{}/stop?t=2", opts.name), None).await;
    let _ = docker_delete(&format!("/containers/{}?force=true", opts.name)).await;
    if let Some(&first_port) = opts.dev_ports.first() {
        for _ in 0..5 {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if std::net::TcpListener::bind(("127.0.0.1", first_port)).is_ok() {
                break;
            }
        }
    }

    let web_port = opts.api_port + 1;

    let entrypoint = format!(
        r#"set -e
export PATH="$HOME/.local/bin:$PATH"

echo "nameserver 8.8.8.8" >> /etc/resolv.conf
echo "nameserver 1.1.1.1" >> /etc/resolv.conf

echo "[1/5] Installing system packages..."
for i in 1 2 3; do
  apt-get update -qq && break
  echo "  Retry $i..."
  sleep 2
done
apt-get install -y -qq git openssh-client curl openssl >/dev/null 2>&1
echo "[1/5] ✓ Done"

echo "[2/5] Setting up SSH..."
if ls /root/.ssh/id_* >/dev/null 2>&1; then
  echo "  Using mounted SSH keys"
  mkdir -p /tmp/ssh && cp /root/.ssh/id_* /tmp/ssh/ 2>/dev/null
  chmod 700 /tmp/ssh && chmod 600 /tmp/ssh/id_*
  ssh-keyscan github.com >> /tmp/ssh/known_hosts 2>/dev/null
  SSH_KEY=$(ls /tmp/ssh/id_* | grep -v '\.pub$' | head -1)
  if [ -n "$SSH_KEY_NAME" ] && [ -f "/tmp/ssh/$SSH_KEY_NAME" ]; then
    SSH_KEY="/tmp/ssh/$SSH_KEY_NAME"
  fi
  echo "  Using key: $(basename $SSH_KEY)"
  if [ -n "$SSH_PASSPHRASE" ]; then
    echo "  Removing passphrase from key copy..."
    ssh-keygen -p -P "$SSH_PASSPHRASE" -N "" -f "$SSH_KEY" >/dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo "  ✗ Failed to remove passphrase — wrong passphrase?"
    else
      echo "  ✓ Passphrase removed from copy"
    fi
    unset SSH_PASSPHRASE
  fi
  export GIT_SSH_COMMAND="ssh -i $SSH_KEY -F /dev/null -o UserKnownHostsFile=/tmp/ssh/known_hosts -o StrictHostKeyChecking=no"
else
  mkdir -p /root/.ssh && chmod 700 /root/.ssh
  printf "%s" "$ENCRYPTED_KEY" | base64 -d | openssl aes-256-cbc -d -pbkdf2 -pass pass:"$TEAM_PASS" > /root/.ssh/id_ed25519
  chmod 600 /root/.ssh/id_ed25519
  ssh-keyscan github.com >> /root/.ssh/known_hosts 2>/dev/null
  unset ENCRYPTED_KEY TEAM_PASS
fi
echo "[2/5] ✓ Done"

echo "[3/5] Configuring git..."
git config --global user.name "{git_name}"
git config --global user.email "{git_email}"
echo "[3/5] ✓ Done"

echo "[4/5] Cloning repo..."
mkdir -p /workspace
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "  Repo already cloned, pulling latest..."
  cd "$REPO_DIR" && git pull
fi
cd "$REPO_DIR"
if command -v otto >/dev/null 2>&1; then
  echo "  otto already installed: $(otto --version 2>&1 | head -1)"
else
  curl -fsSL https://install.ottocode.io | sh
fi
echo "[4/5] ✓ Done"

echo ""
echo "════════════════════════════════════════"
echo "  ✓ Otto is ready!"
echo "  Open http://localhost:{web_port} in your browser"
echo "════════════════════════════════════════"
echo ""

echo "[5/5] Starting otto..."
export PATH="$HOME/.local/bin:$PATH"
cd "$REPO_DIR"
otto serve --network --port {api_port} --no-open"#,
        git_name = opts.git_name,
        git_email = opts.git_email,
        web_port = web_port,
        api_port = opts.api_port,
    );

    let mut port_bindings = serde_json::Map::new();
    port_bindings.insert(
        format!("{}/tcp", opts.api_port),
        serde_json::json!([{"HostPort": opts.api_port.to_string()}]),
    );
    port_bindings.insert(
        format!("{}/tcp", web_port),
        serde_json::json!([{"HostPort": web_port.to_string()}]),
    );
    for &p in &opts.dev_ports {
        port_bindings.insert(
            format!("{}/tcp", p),
            serde_json::json!([{"HostPort": p.to_string()}]),
        );
    }

    let mut exposed_ports = serde_json::Map::new();
    exposed_ports.insert(format!("{}/tcp", opts.api_port), serde_json::json!({}));
    exposed_ports.insert(format!("{}/tcp", web_port), serde_json::json!({}));
    for &p in &opts.dev_ports {
        exposed_ports.insert(format!("{}/tcp", p), serde_json::json!({}));
    }

    let create_body = serde_json::json!({
        "Image": opts.image,
        "Cmd": ["bash", "-c", entrypoint],
        "Env": [
            format!("ENCRYPTED_KEY={}", opts.encrypted_key),
            format!("TEAM_PASS={}", opts.password),
            format!("REPO_URL={}", opts.repo_url),
            format!("REPO_DIR={}", opts.repo_dir),
            format!("OTTO_PORT={}", opts.api_port),
            format!("SSH_KEY_NAME={}", opts.ssh_key_name),
            format!("SSH_PASSPHRASE={}", opts.ssh_passphrase),
        ],
        "ExposedPorts": exposed_ports,
        "HostConfig": {
            "PortBindings": port_bindings,
            "Dns": ["8.8.8.8", "8.8.4.4", "1.1.1.1"],
            "Binds": if opts.use_personal_ssh {
                let home = dirs::home_dir().unwrap_or_default();
                let ssh_path = home.join(".ssh").to_string_lossy().to_string();
                serde_json::json!([format!("{}:/root/.ssh:ro", ssh_path)])
            } else {
                serde_json::json!([])
            },
        },
    });

    let body = docker_post(
        &format!("/containers/create?name={}", opts.name),
        Some(create_body),
    )
    .await?;

    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let id = json["Id"].as_str().unwrap_or("").to_string();

    if let Err(e) = docker_post(&format!("/containers/{}/start", id), None).await {
        let _ = docker_delete(&format!("/containers/{}?force=true", id)).await;
        return Err(e);
    }

    Ok(id)
}

#[tauri::command]
pub async fn container_start(name: String) -> Result<(), String> {
    docker_post(&format!("/containers/{}/start", name), None).await?;
    Ok(())
}

#[tauri::command]
pub async fn container_stop(name: String) -> Result<(), String> {
    docker_post(&format!("/containers/{}/stop", name), None).await?;
    Ok(())
}

#[tauri::command]
pub async fn container_remove(name: String) -> Result<(), String> {
    docker_delete(&format!("/containers/{}?force=true", name)).await?;
    Ok(())
}

#[tauri::command]
pub async fn container_logs(name: String, lines: u32) -> Result<String, String> {
    let body = docker_get(&format!(
        "/containers/{}/logs?stdout=true&stderr=true&tail={}",
        name, lines
    ))
    .await?;
    let cleaned: String = body
        .bytes()
        .enumerate()
        .filter_map(|(i, b)| {
            if i % 8 < 8 && b.is_ascii_graphic() || b == b' ' || b == b'\n' || b == b'\r' {
                Some(b as char)
            } else {
                None
            }
        })
        .collect();
    Ok(cleaned)
}

#[tauri::command]
pub async fn container_exec(name: String, cmd: String) -> Result<String, String> {
    let exec_body = serde_json::json!({
        "AttachStdout": true,
        "AttachStderr": true,
        "Cmd": ["bash", "-c", cmd],
    });

    let body =
        docker_post(&format!("/containers/{}/exec", name), Some(exec_body)).await?;

    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let exec_id = json["Id"].as_str().unwrap_or("").to_string();

    let start_body = serde_json::json!({"Detach": false, "Tty": false});
    let output = docker_post(&format!("/exec/{}/start", exec_id), Some(start_body)).await?;

    Ok(output)
}

#[tauri::command]
pub async fn container_restart_otto(
    name: String,
    _repo_dir: String,
    _api_port: u16,
) -> Result<(), String> {
    docker_post(&format!("/containers/{}/restart?t=2", name), None).await?;
    Ok(())
}

#[tauri::command]
pub async fn container_update_otto(name: String) -> Result<String, String> {
    let cmd = r#"export PATH="$HOME/.local/bin:$PATH"; BEFORE=$(otto --version 2>&1 | head -1 || echo "unknown"); curl -fsSL https://install.ottocode.io | sh 2>&1; export PATH="$HOME/.local/bin:$PATH"; AFTER=$(otto --version 2>&1 | head -1 || echo "unknown"); echo "$BEFORE -> $AFTER""#;
    container_exec(name.clone(), cmd.to_string()).await
}

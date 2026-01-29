import { useState } from "react";
import { useProjects } from "./hooks/useProjects";
import { useGitHub } from "./hooks/useGitHub";
import { useServer } from "./hooks/useServer";
import type { Project } from "./lib/tauri-bridge";
import "./App.css";

type View = "picker" | "workspace";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ProjectPicker({
  onSelectProject,
}: {
  onSelectProject: (project: Project) => void;
}) {
  const { projects, loading, openProjectDialog, removeProject, togglePinned } =
    useProjects();
  const { user, isAuthenticated, saveToken, logout, loadRepos, repos, cloneRepo } =
    useGitHub();
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
 const [tokenInput, setTokenInput] = useState("");
  const [clonePath] = useState("");
 const [cloning, setCloning] = useState(false);

  const handleOpenFolder = async () => {
    const project = await openProjectDialog();
    if (project) {
      onSelectProject(project);
    }
  };

  const handleClone = async () => {
    setShowCloneModal(true);
    await loadRepos();
  };

  const handleCloneRepo = async (url: string, name: string) => {
    const homeDir = "~/Projects";
    const targetPath = clonePath || `${homeDir}/${name}`;
    try {
      setCloning(true);
      await cloneRepo(url, targetPath);
      setShowCloneModal(false);
      const project: Project = {
        path: targetPath,
        name,
        lastOpened: new Date().toISOString(),
        pinned: false,
      };
      onSelectProject(project);
    } catch (err) {
      alert(`Clone failed: ${err}`);
    } finally {
      setCloning(false);
    }
  };

  const handleSaveToken = async () => {
    try {
      await saveToken(tokenInput);
      setShowTokenInput(false);
      setTokenInput("");
    } catch {
      alert("Invalid token");
    }
  };

  const pinnedProjects = projects.filter((p) => p.pinned);
  const recentProjects = projects.filter((p) => !p.pinned);

  return (
    <div className="picker">
      <header className="picker-header">
        <h1>AGI</h1>
        <p>AI-powered development assistant</p>
      </header>

      <div className="picker-actions">
        <button className="action-btn" onClick={handleOpenFolder}>
          <span className="icon">📁</span>
          <span>Open Folder</span>
        </button>
        <button
          className="action-btn"
          onClick={handleClone}
          disabled={!isAuthenticated}
        >
          <span className="icon">🐙</span>
          <span>Clone from GitHub</span>
        </button>
      </div>

      {pinnedProjects.length > 0 && (
        <section className="projects-section">
          <h2>⭐ Pinned</h2>
          <ul className="projects-list">
            {pinnedProjects.map((project) => (
              <li key={project.path} className="project-item">
                <button
                  className="project-btn"
                  onClick={() => onSelectProject(project)}
                >
                  <span className="project-name">{project.name}</span>
                  <span className="project-path">{project.path}</span>
                  <span className="project-time">
                    {formatTimeAgo(project.lastOpened)}
                  </span>
                </button>
                <div className="project-actions">
                  <button
                    className="icon-btn"
                    onClick={() => togglePinned(project.path)}
                    title="Unpin"
                  >
                    ⭐
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => removeProject(project.path)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentProjects.length > 0 && (
        <section className="projects-section">
          <h2>Recent</h2>
          <ul className="projects-list">
            {recentProjects.map((project) => (
              <li key={project.path} className="project-item">
                <button
                  className="project-btn"
                  onClick={() => onSelectProject(project)}
                >
                  <span className="project-name">{project.name}</span>
                  <span className="project-path">{project.path}</span>
                  <span className="project-time">
                    {formatTimeAgo(project.lastOpened)}
                  </span>
                </button>
                <div className="project-actions">
                  <button
                    className="icon-btn"
                    onClick={() => togglePinned(project.path)}
                    title="Pin"
                  >
                    ☆
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => removeProject(project.path)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading && projects.length === 0 && (
        <p className="empty-state">Loading...</p>
      )}

      {!loading && projects.length === 0 && (
        <p className="empty-state">No recent projects. Open a folder to get started.</p>
      )}

      <footer className="picker-footer">
        {isAuthenticated ? (
          <div className="github-user">
            <img src={user?.avatarUrl} alt="" className="avatar" />
            <span>{user?.login}</span>
            <button className="text-btn" onClick={logout}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="text-btn" onClick={() => setShowTokenInput(true)}>
            🔗 Connect GitHub
          </button>
        )}
      </footer>

      {showTokenInput && (
        <div className="modal-overlay" onClick={() => setShowTokenInput(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Connect GitHub</h3>
            <p>
              Create a{" "}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,user"
                target="_blank"
                rel="noopener noreferrer"
              >
                Personal Access Token
              </a>{" "}
              with <code>repo</code> and <code>user</code> scopes.
            </p>
            <input
              type="password"
              placeholder="ghp_..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowTokenInput(false)}>Cancel</button>
              <button onClick={handleSaveToken} disabled={!tokenInput}>
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloneModal && (
        <div className="modal-overlay" onClick={() => setShowCloneModal(false)}>
          <div className="modal clone-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Clone from GitHub</h3>
            <ul className="repo-list">
              {repos.map((repo) => (
                <li key={repo.id} className="repo-item">
                  <div className="repo-info">
                    <span className="repo-name">
                      {repo.private ? "🔒" : "📦"} {repo.fullName}
                    </span>
                    {repo.description && (
                      <span className="repo-desc">{repo.description}</span>
                    )}
                  </div>
                  <button
                    className="clone-btn"
                    onClick={() => handleCloneRepo(repo.cloneUrl, repo.name)}
                    disabled={cloning}
                  >
                    Clone
                  </button>
                </li>
              ))}
            </ul>
            {repos.length === 0 && <p className="empty-state">Loading repositories...</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Workspace({ project, onBack }: { project: Project; onBack: () => void }) {
  const { server, loading, error, startServer, stopServer } = useServer();

  const handleStartServer = async () => {
    await startServer(project.path);
  };

  return (
    <div className="workspace">
      <header className="workspace-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>{project.name}</h1>
        <span className="project-path">{project.path}</span>
      </header>

      <main className="workspace-main">
        {!server ? (
          <div className="server-start">
            <p>Start the AGI server to begin working on this project.</p>
            <button
              className="primary-btn"
              onClick={handleStartServer}
              disabled={loading}
            >
              {loading ? "Starting..." : "Start Server"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        ) : (
          <div className="server-running">
            <div className="server-info">
              <p>
                Server running at{" "}
                <a href={server.url} target="_blank" rel="noopener noreferrer">
                  {server.url}
                </a>
              </p>
              <p className="server-details">
                API: port {server.port} | Web: port {server.webPort} | PID:{" "}
                {server.pid}
              </p>
            </div>
            <iframe
              src={server.url}
              className="workspace-frame"
              title="AGI Workspace"
            />
            <button className="stop-btn" onClick={stopServer}>
              Stop Server
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>("picker");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setView("workspace");
  };

  const handleBack = () => {
    setView("picker");
    setSelectedProject(null);
  };

  return (
    <div className="app">
      {view === "picker" && <ProjectPicker onSelectProject={handleSelectProject} />}
      {view === "workspace" && selectedProject && (
        <Workspace project={selectedProject} onBack={handleBack} />
      )}
    </div>
  );
}

export default App;

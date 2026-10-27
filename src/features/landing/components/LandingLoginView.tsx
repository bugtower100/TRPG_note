import React from 'react';
import { ChevronDown } from 'lucide-react';
import './LandingLoginView.css';

interface LoginUserOption {
  id: string;
  username: string;
}

interface LandingLoginViewProps {
  appVersion: string;
  username: string;
  password: string;
  loginError: string;
  users: LoginUserOption[];
  historyOpen: boolean;
  onlinePreview: boolean | null;
  latency: number | null;
  historyRef: React.RefObject<HTMLDivElement>;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleHistory: () => void;
  onSelectHistoryUser: (username: string) => void;
  onFocusUsername: () => void;
  onRefreshLatency: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

const LandingLoginView: React.FC<LandingLoginViewProps> = ({
  appVersion,
  username,
  password,
  loginError,
  users,
  historyOpen,
  onlinePreview,
  latency,
  historyRef,
  onUsernameChange,
  onPasswordChange,
  onToggleHistory,
  onSelectHistoryUser,
  onFocusUsername,
  onRefreshLatency,
  onSubmit,
}) => {
  return (
    <main className="login-page theme-page">
      <svg className="login-stars login-stars--left" viewBox="0 0 220 160" aria-hidden="true" focusable="false">
        <path d="M47 2 C51 26 59 34 83 38 C59 42 51 50 47 74 C43 50 35 42 11 38 C35 34 43 26 47 2Z" />
        <path d="M168 42 C171 61 177 67 196 70 C177 73 171 79 168 98 C165 79 159 73 140 70 C159 67 165 61 168 42Z" />
        <path d="M105 104 C107 116 111 120 123 122 C111 124 107 128 105 140 C103 128 99 124 87 122 C99 120 103 116 105 104Z" />
      </svg>
      <svg className="login-stars" viewBox="0 0 220 160" aria-hidden="true" focusable="false">
        <path d="M47 2 C51 26 59 34 83 38 C59 42 51 50 47 74 C43 50 35 42 11 38 C35 34 43 26 47 2Z" />
        <path d="M168 42 C171 61 177 67 196 70 C177 73 171 79 168 98 C165 79 159 73 140 70 C159 67 165 61 168 42Z" />
        <path d="M105 104 C107 116 111 120 123 122 C111 124 107 128 105 140 C103 128 99 124 87 122 C99 120 103 116 105 104Z" />
      </svg>
      <div className="login-shell">
        <div className="login-panel">
          <div className="login-header">
            <span className="login-eyebrow">欢迎回到冒险之中</span>
            <h1>TRPG 模组笔记</h1>
            <p className="login-version">{appVersion}</p>
            <p className="login-subtitle">登录后继续整理模组与跑团记录</p>
            <img
              src="/login-illustration.gif"
              alt=""
              aria-hidden="true"
              className="login-illustration"
            />
          </div>

        <form onSubmit={onSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-username">用户名 / 昵称</label>
            <div className="relative" ref={historyRef}>
              <div className="login-username-row">
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(event) => onUsernameChange(event.target.value)}
                  onFocus={onFocusUsername}
                  autoComplete="username"
                  placeholder="请输入您的名字"
                  required
                />
                <button
                  type="button"
                  className="login-history-toggle"
                  onClick={onToggleHistory}
                  aria-label="展开历史用户"
                  aria-expanded={historyOpen}
                >
                  <ChevronDown size={18} strokeWidth={1.7} />
                </button>
              </div>
              {historyOpen && users.length > 0 && (
                <div className="login-history-list">
                  {users
                    .filter((user) => !username || user.username.toLowerCase().includes(username.toLowerCase()))
                    .map((user) => (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => onSelectHistoryUser(user.username)}
                      >
                        {user.username}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="login-password">登录密码</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="未设置密码时可留空"
            />
          </div>
          <div className="login-connection">
            <span className={`login-connection-dot ${onlinePreview === false ? 'is-offline' : ''}`} aria-hidden="true" />
            <span>
              {onlinePreview === null ? '正在检测连接状态' : (
                onlinePreview
                  ? `已连接后端${typeof latency === 'number' ? `（≈${latency}ms）` : ''}`
                  : '后端未连接：数据可能不会被保存，请注意导出 JSON'
              )}
            </span>
            <button
              type="button"
              onClick={onRefreshLatency}
            >
              重新检测
            </button>
          </div>
          {loginError && (
            <div className="login-error" role="alert">{loginError}</div>
          )}

          <button type="submit" className="login-submit">
            进入系统
          </button>
        </form>
        </div>
      </div>
    </main>
  );
};

export default LandingLoginView;

import React from 'react';
import { ChevronDown } from 'lucide-react';

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
    <div className="flex justify-center items-center min-h-screen theme-page px-4">
      <div className="p-8 w-full max-w-md rounded-lg border shadow-md theme-card border-theme">
        <h1 className="mb-2 text-3xl font-bold text-center text-theme-primary">TRPG 模组笔记</h1>
        <p className="mb-2 text-center theme-text-secondary">{appVersion}</p>
        <p className="mb-3 text-center theme-text-secondary">请登录以管理您的模组</p>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="block mb-1 text-sm font-medium text-theme-primary">用户名 / 昵称</label>
            <div className="relative" ref={historyRef}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(event) => onUsernameChange(event.target.value)}
                  onFocus={onFocusUsername}
                  className="px-4 py-2 flex-1 rounded-md border border-theme bg-transparent outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="请输入您的名字"
                  required
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border border-theme theme-card hover:bg-primary-light"
                  onClick={onToggleHistory}
                  aria-label="展开历史用户"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
              {historyOpen && users.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-theme theme-card shadow">
                  {users
                    .filter((user) => !username || user.username.toLowerCase().includes(username.toLowerCase()))
                    .map((user) => (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => onSelectHistoryUser(user.username)}
                        className="block w-full text-left px-3 py-2 hover:bg-primary-light"
                      >
                        {user.username}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-theme-primary">登录密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="px-4 py-2 w-full rounded-md border border-theme bg-transparent outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="未设置密码时可留空"
            />
          </div>
          <div className="text-xs theme-text-secondary">
            {onlinePreview === null ? '' : (
              onlinePreview
                ? `已连接后端${typeof latency === 'number' ? `（≈${latency}ms）` : ''}`
                : '后端未连接：数据可能不会被保存，请注意导出 JSON'
            )}
            <button
              type="button"
              className="ml-2 px-2 py-1 border rounded border-theme hover:bg-primary-light"
              onClick={onRefreshLatency}
            >
              重新检测
            </button>
          </div>
          {loginError && (
            <div className="text-sm text-red-600">{loginError}</div>
          )}

          <button
            type="submit"
            className="py-3 w-full font-medium text-white rounded-md shadow-sm transition-colors bg-primary hover:bg-primary-dark"
          >
            进入系统
          </button>
        </form>
      </div>
    </div>
  );
};

export default LandingLoginView;

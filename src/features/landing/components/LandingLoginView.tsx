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
    <div className="flex justify-center items-center min-h-screen bg-stone-50">
      <div className="p-8 w-full max-w-md bg-white rounded-lg border shadow-md border-stone-200">
        <h1 className="mb-2 text-3xl font-bold text-center text-gray-800">TRPG 模组笔记</h1>
        <p className="mb-2 text-center text-gray-500">{appVersion}</p>
        <p className="mb-3 text-center text-gray-500">请登录以管理您的模组</p>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">用户名 / 昵称</label>
            <div className="relative" ref={historyRef}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(event) => onUsernameChange(event.target.value)}
                  onFocus={onFocusUsername}
                  className="px-4 py-2 flex-1 rounded-md border border-gray-300 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="请输入您的名字"
                  required
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                  onClick={onToggleHistory}
                  aria-label="展开历史用户"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
              {historyOpen && users.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow">
                  {users
                    .filter((user) => !username || user.username.toLowerCase().includes(username.toLowerCase()))
                    .map((user) => (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => onSelectHistoryUser(user.username)}
                        className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                      >
                        {user.username}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">登录密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="px-4 py-2 w-full rounded-md border border-gray-300 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="未设置密码时可留空"
            />
          </div>
          <div className="text-xs text-gray-600">
            {onlinePreview === null ? '' : (
              onlinePreview
                ? `已连接后端${typeof latency === 'number' ? `（≈${latency}ms）` : ''}`
                : '后端未连接：数据可能不会被保存，请注意导出 JSON'
            )}
            <button
              type="button"
              className="ml-2 px-2 py-1 border rounded border-gray-300 hover:bg-gray-50"
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

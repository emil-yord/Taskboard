import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function Boards() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .get('/boards')
      .then(({ data }) => setBoards(data.boards))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/boards', { name: newName.trim() });
      navigate(`/boards/${data.board.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-10">
        <div className="inline-flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          <span className="font-mono text-xs tracking-widest text-muted uppercase">
            Corkboard
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{user?.name}</span>
          <button onClick={logout} className="text-sm text-muted hover:text-ink transition">
            Sign out
          </button>
        </div>
      </header>

      <h1 className="font-display text-3xl font-semibold mb-1">Your boards</h1>
      <p className="text-muted text-sm mb-8">Pick one up, or pin a new one to the wall.</p>

      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New board name…"
          className="flex-1 bg-surface border border-line rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-accent text-bg font-semibold rounded px-4 py-2 text-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create board'}
        </button>
      </form>

      {loading ? (
        <p className="text-muted text-sm">Loading boards…</p>
      ) : boards.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-muted text-sm">
          No boards yet. Create your first one above.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {boards.map((board) => (
            <Link
              key={board.id}
              to={`/boards/${board.id}`}
              className="bg-surface border border-line rounded-lg p-5 hover:border-accent transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-muted uppercase tracking-wide">
                  Board
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-line group-hover:bg-accent transition" />
              </div>
              <h2 className="font-display text-lg font-semibold group-hover:text-accent transition">
                {board.name}
              </h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

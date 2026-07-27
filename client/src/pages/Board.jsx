import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { getSocket } from '../socket';
import { useAuth } from '../AuthContext';
import List from '../components/List';

export default function Board() {
  const { boardId } = useParams();
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const dragCardRef = useRef(null); // { card, sourceListId }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/boards/${boardId}`)
      .then(({ data }) => {
        if (!cancelled) setBoard(data.board);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load board');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  // ---- Real-time socket wiring ----
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('board:join', boardId);

    const onListCreated = ({ boardId: bId, list }) => {
      if (bId !== boardId) return;
      setBoard((prev) => (prev ? { ...prev, lists: [...prev.lists, list] } : prev));
    };

    const onListUpdated = ({ boardId: bId, list }) => {
      if (bId !== boardId) return;
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              lists: prev.lists
                .map((l) => (l.id === list.id ? { ...l, ...list } : l))
                .sort((a, b) => a.position - b.position)
            }
          : prev
      );
    };

    const onListDeleted = ({ boardId: bId, listId }) => {
      if (bId !== boardId) return;
      setBoard((prev) =>
        prev ? { ...prev, lists: prev.lists.filter((l) => l.id !== listId) } : prev
      );
    };

    const onCardCreated = ({ boardId: bId, card }) => {
      if (bId !== boardId) return;
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              lists: prev.lists.map((l) =>
                l.id === card.list_id ? { ...l, cards: [...l.cards, card] } : l
              )
            }
          : prev
      );
    };

    const onCardUpdated = ({ boardId: bId, card }) => {
      if (bId !== boardId) return;
      setBoard((prev) => {
        if (!prev) return prev;
        const lists = prev.lists.map((l) => ({
          ...l,
          cards: l.cards.filter((c) => c.id !== card.id)
        }));
        const destIndex = lists.findIndex((l) => l.id === card.list_id);
        if (destIndex !== -1) {
          lists[destIndex] = {
            ...lists[destIndex],
            cards: [...lists[destIndex].cards, card].sort((a, b) => a.position - b.position)
          };
        }
        return { ...prev, lists };
      });
    };

    const onCardDeleted = ({ boardId: bId, cardId }) => {
      if (bId !== boardId) return;
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              lists: prev.lists.map((l) => ({
                ...l,
                cards: l.cards.filter((c) => c.id !== cardId)
              }))
            }
          : prev
      );
    };

    const onMemberAdded = ({ boardId: bId, user: newMember }) => {
      if (bId !== boardId) return;
      setBoard((prev) =>
        prev ? { ...prev, members: [...prev.members, newMember] } : prev
      );
    };

    socket.on('list:created', onListCreated);
    socket.on('list:updated', onListUpdated);
    socket.on('list:deleted', onListDeleted);
    socket.on('card:created', onCardCreated);
    socket.on('card:updated', onCardUpdated);
    socket.on('card:deleted', onCardDeleted);
    socket.on('member:added', onMemberAdded);

    return () => {
      socket.emit('board:leave', boardId);
      socket.off('list:created', onListCreated);
      socket.off('list:updated', onListUpdated);
      socket.off('list:deleted', onListDeleted);
      socket.off('card:created', onCardCreated);
      socket.off('card:updated', onCardUpdated);
      socket.off('card:deleted', onCardDeleted);
      socket.off('member:added', onMemberAdded);
    };
  }, [boardId]);

  // ---- List actions ----

  async function handleAddList(e) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const { data } = await api.post(`/boards/${boardId}/lists`, { name: newListName.trim() });
    setBoard((prev) => (prev ? { ...prev, lists: [...prev.lists, data.list] } : prev));
    setNewListName('');
    setAddingList(false);
  }

  async function handleRenameList(listId, name) {
    await api.patch(`/boards/lists/${listId}`, { name });
    setBoard((prev) =>
      prev
        ? { ...prev, lists: prev.lists.map((l) => (l.id === listId ? { ...l, name } : l)) }
        : prev
    );
  }

  async function handleDeleteList(listId) {
    if (!confirm('Delete this list and all its cards?')) return;
    await api.delete(`/boards/lists/${listId}`);
    setBoard((prev) =>
      prev ? { ...prev, lists: prev.lists.filter((l) => l.id !== listId) } : prev
    );
  }

  // ---- Card actions ----

  async function handleAddCard(listId, title) {
    const { data } = await api.post(`/boards/lists/${listId}/cards`, { title });
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            lists: prev.lists.map((l) =>
              l.id === listId ? { ...l, cards: [...l.cards, data.card] } : l
            )
          }
        : prev
    );
  }

  async function handleUpdateCard(cardId, patch) {
    const { data } = await api.patch(`/boards/cards/${cardId}`, patch);
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            lists: prev.lists.map((l) => ({
              ...l,
              cards: l.cards.map((c) => (c.id === cardId ? { ...c, ...data.card } : c))
            }))
          }
        : prev
    );
  }

  async function handleDeleteCard(cardId) {
    await api.delete(`/boards/cards/${cardId}`);
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            lists: prev.lists.map((l) => ({
              ...l,
              cards: l.cards.filter((c) => c.id !== cardId)
            }))
          }
        : prev
    );
  }

  // ---- Drag and drop ----

  const handleDragStart = useCallback((e, card, sourceListId) => {
    dragCardRef.current = { card, sourceListId };
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  async function handleDropCard(destListId, dropIndex) {
    const dragged = dragCardRef.current;
    dragCardRef.current = null;
    if (!dragged || !board) return;

    const destList = board.lists.find((l) => l.id === destListId);
    if (!destList) return;

    // Build the list of cards currently in the destination, excluding the dragged card itself
    const siblings = destList.cards.filter((c) => c.id !== dragged.card.id);
    const before = siblings[dropIndex - 1];
    const after = siblings[dropIndex];

    let newPosition;
    if (!before && !after) newPosition = 0;
    else if (!before) newPosition = after.position - 1;
    else if (!after) newPosition = before.position + 1;
    else newPosition = (before.position + after.position) / 2;

    // Optimistic local update
    setBoard((prev) => {
      if (!prev) return prev;
      const lists = prev.lists.map((l) => ({
        ...l,
        cards: l.cards.filter((c) => c.id !== dragged.card.id)
      }));
      const idx = lists.findIndex((l) => l.id === destListId);
      const updatedCard = { ...dragged.card, list_id: destListId, position: newPosition };
      lists[idx] = {
        ...lists[idx],
        cards: [...lists[idx].cards, updatedCard].sort((a, b) => a.position - b.position)
      };
      return { ...prev, lists };
    });

    try {
      await api.patch(`/boards/cards/${dragged.card.id}`, {
        list_id: destListId,
        position: newPosition
      });
    } catch (err) {
      // Reload on failure to resync state
      const { data } = await api.get(`/boards/${boardId}`);
      setBoard(data.board);
    }
  }

  // ---- Invite ----

  async function handleInvite(e) {
    e.preventDefault();
    setInviteMsg('');
    try {
      const { data } = await api.post(`/boards/${boardId}/invite`, { email: inviteEmail });
      setBoard((prev) =>
        prev ? { ...prev, members: [...prev.members, data.member] } : prev
      );
      setInviteMsg(`Added ${data.member.name} to the board.`);
      setInviteEmail('');
    } catch (err) {
      setInviteMsg(err.response?.data?.error || 'Could not add that person.');
    }
  }

  if (loading) {
    return <div className="p-10 text-muted text-sm">Loading board…</div>;
  }

  if (error) {
    return (
      <div className="p-10">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <Link to="/" className="text-accent text-sm hover:underline">
          Back to boards
        </Link>
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="text-muted hover:text-ink transition text-sm shrink-0">
            ← Boards
          </Link>
          <h1 className="font-display text-xl font-semibold truncate">{board.name}</h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex -space-x-2">
            {board.members.map((m) => (
              <div
                key={m.id}
                title={`${m.name} (${m.email})`}
                className="w-7 h-7 rounded-full bg-accentSoft border border-accent flex items-center justify-center font-mono text-[10px] text-accent"
              >
                {m.name.slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
          <button
            onClick={() => setInviteOpen((v) => !v)}
            className="text-xs bg-surface border border-line hover:border-accent rounded px-3 py-1.5 transition"
          >
            + Invite
          </button>
        </div>
      </header>

      {inviteOpen && (
        <div className="border-b border-line px-6 py-3 bg-surface">
          <form onSubmit={handleInvite} className="flex gap-2 items-center max-w-md">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="flex-1 bg-raised border border-line rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              className="text-xs bg-accent text-bg font-semibold rounded px-3 py-1.5"
            >
              Add
            </button>
          </form>
          {inviteMsg && <p className="text-xs text-muted mt-2">{inviteMsg}</p>}
        </div>
      )}

      <main className="flex-1 overflow-x-auto scrollbar-thin px-6 py-6">
        <div className="flex gap-4 items-start min-h-full">
          {board.lists.map((list) => (
            <List
              key={list.id}
              list={list}
              onDragStart={handleDragStart}
              onDropCard={handleDropCard}
              onAddCard={handleAddCard}
              onUpdateCard={handleUpdateCard}
              onDeleteCard={handleDeleteCard}
              onDeleteList={handleDeleteList}
              onRenameList={handleRenameList}
            />
          ))}

          <div className="w-72 shrink-0">
            {addingList ? (
              <form
                onSubmit={handleAddList}
                className="bg-surface border border-line rounded-md p-3 space-y-2"
              >
                <input
                  autoFocus
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name…"
                  className="w-full bg-raised border border-line rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="text-xs bg-accent text-bg rounded px-2 py-1 font-semibold"
                  >
                    Add list
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingList(false)}
                    className="text-xs text-muted hover:text-ink px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="w-full text-left text-sm text-muted hover:text-accent border border-dashed border-line hover:border-accent/60 rounded-md px-4 py-3 transition"
              >
                + Add another list
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

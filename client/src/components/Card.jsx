import { useState } from 'react';

export default function Card({ card, listId, onDragStart, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');

  function save() {
    if (!title.trim()) {
      setTitle(card.title);
      setEditing(false);
      return;
    }
    onUpdate(card.id, { title: title.trim(), description });
    setEditing(false);
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card, listId)}
      data-card-id={card.id}
      className="punch-card card-drop bg-raised border border-line rounded-md py-2.5 pr-3 cursor-grab active:cursor-grabbing hover:border-accent/60 transition group"
    >
      {editing ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-bg border border-line rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-bg border border-line rounded px-2 py-1 text-xs text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              className="text-xs bg-accent text-bg rounded px-2 py-1 font-semibold"
            >
              Save
            </button>
            <button
              onClick={() => {
                setTitle(card.title);
                setDescription(card.description || '');
                setEditing(false);
              }}
              className="text-xs text-muted hover:text-ink px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div onClick={() => setEditing(true)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-snug">{card.title}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(card.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition text-xs shrink-0"
              title="Delete card"
            >
              ✕
            </button>
          </div>
          {card.description && (
            <p className="text-xs text-muted mt-1 line-clamp-2">{card.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

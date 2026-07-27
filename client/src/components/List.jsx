import { useState } from 'react';
import Card from './Card';

export default function List({
  list,
  onDragStart,
  onDropCard,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onDeleteList,
  onRenameList
}) {
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(list.name);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function handleAddCard(e) {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    onAddCard(list.id, newCardTitle.trim());
    setNewCardTitle('');
    setAddingCard(false);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(e, index) {
    e.preventDefault();
    onDropCard(list.id, index);
    setDragOverIndex(null);
  }

  function saveName() {
    if (name.trim() && name.trim() !== list.name) {
      onRenameList(list.id, name.trim());
    } else {
      setName(list.name);
    }
    setEditingName(false);
  }

  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="folder-tab bg-surface border border-line rounded-md px-3 py-2 mb-2 flex items-center justify-between">
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            className="bg-bg border border-line rounded px-1.5 py-0.5 text-sm w-full mr-2 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <h3
            onClick={() => setEditingName(true)}
            className="font-display text-sm font-semibold cursor-text"
          >
            {list.name}
          </h3>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] text-muted">{list.cards.length}</span>
          <button
            onClick={() => onDeleteList(list.id)}
            className="text-muted hover:text-red-400 transition text-xs"
            title="Delete list"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className="flex-1 space-y-2 min-h-[40px] pb-2"
        onDragOver={(e) => handleDragOver(e, list.cards.length)}
        onDrop={(e) => handleDrop(e, list.cards.length)}
      >
        {list.cards.map((card, index) => (
          <div
            key={card.id}
            onDragOver={(e) => {
              e.stopPropagation();
              handleDragOver(e, index);
            }}
            onDrop={(e) => {
              e.stopPropagation();
              handleDrop(e, index);
            }}
            className={dragOverIndex === index ? 'border-t-2 border-accent pt-2' : ''}
          >
            <Card
              card={card}
              listId={list.id}
              onDragStart={onDragStart}
              onUpdate={onUpdateCard}
              onDelete={onDeleteCard}
            />
          </div>
        ))}

        {addingCard ? (
          <form onSubmit={handleAddCard} className="space-y-2">
            <textarea
              autoFocus
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddCard(e);
                }
              }}
              placeholder="Card title…"
              rows={2}
              className="w-full bg-raised border border-line rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="text-xs bg-accent text-bg rounded px-2 py-1 font-semibold"
              >
                Add card
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCard(false);
                  setNewCardTitle('');
                }}
                className="text-xs text-muted hover:text-ink px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="w-full text-left text-xs text-muted hover:text-accent border border-dashed border-line hover:border-accent/60 rounded-md px-3 py-2 transition"
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
}

const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function isMember(boardId, userId) {
  return !!db
    .prepare('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?')
    .get(boardId, userId);
}

function getBoardFull(boardId) {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
  if (!board) return null;

  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, bm.role FROM board_members bm
       JOIN users u ON u.id = bm.user_id WHERE bm.board_id = ?`
    )
    .all(boardId);

  const lists = db
    .prepare('SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC')
    .all(boardId);

  const cardsStmt = db.prepare('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC');
  const listsWithCards = lists.map((list) => ({
    ...list,
    cards: cardsStmt.all(list.id)
  }));

  return { ...board, members, lists: listsWithCards };
}

// ---- Boards ----

router.get('/', (req, res) => {
  const boards = db
    .prepare(
      `SELECT b.* FROM boards b
       JOIN board_members bm ON bm.board_id = b.id
       WHERE bm.user_id = ? ORDER BY b.created_at DESC`
    )
    .all(req.userId);
  res.json({ boards });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Board name is required' });
  }

  const id = uuid();
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO boards (id, name, owner_id) VALUES (?, ?, ?)').run(
      id,
      name.trim(),
      req.userId
    );
    db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(
      id,
      req.userId,
      'owner'
    );
    // Seed with default lists so the board isn't empty
    const defaults = ['To Do', 'In Progress', 'Done'];
    defaults.forEach((name, i) => {
      db.prepare('INSERT INTO lists (id, board_id, name, position) VALUES (?, ?, ?, ?)').run(
        uuid(),
        id,
        name,
        i
      );
    });
  });
  tx();

  res.status(201).json({ board: getBoardFull(id) });
});

router.get('/:boardId', (req, res) => {
  if (!isMember(req.params.boardId, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }
  const board = getBoardFull(req.params.boardId);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json({ board });
});

router.post('/:boardId/invite', (req, res) => {
  const { boardId } = req.params;
  const { email } = req.body;

  if (!isMember(boardId, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'No user found with that email' });
  }

  const already = isMember(boardId, user.id);
  if (already) {
    return res.status(409).json({ error: 'That user is already a member' });
  }

  db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(
    boardId,
    user.id,
    'member'
  );

  const io = req.app.get('io');
  io.to(`board:${boardId}`).emit('member:added', { boardId, user: { id: user.id, name: user.name, email: user.email, role: 'member' } });

  res.status(201).json({ member: { id: user.id, name: user.name, email: user.email, role: 'member' } });
});

// ---- Lists ----

router.post('/:boardId/lists', (req, res) => {
  const { boardId } = req.params;
  const { name } = req.body;

  if (!isMember(boardId, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'List name is required' });
  }

  const maxPos = db
    .prepare('SELECT MAX(position) as maxPos FROM lists WHERE board_id = ?')
    .get(boardId).maxPos;

  const list = {
    id: uuid(),
    board_id: boardId,
    name: name.trim(),
    position: (maxPos ?? -1) + 1
  };

  db.prepare('INSERT INTO lists (id, board_id, name, position) VALUES (?, ?, ?, ?)').run(
    list.id,
    list.board_id,
    list.name,
    list.position
  );

  const full = { ...list, cards: [] };
  const io = req.app.get('io');
  io.to(`board:${boardId}`).emit('list:created', { boardId, list: full });

  res.status(201).json({ list: full });
});

router.patch('/lists/:listId', (req, res) => {
  const { listId } = req.params;
  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'List not found' });
  if (!isMember(list.board_id, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }

  const name = req.body.name !== undefined ? req.body.name.trim() : list.name;
  const position = req.body.position !== undefined ? req.body.position : list.position;

  db.prepare('UPDATE lists SET name = ?, position = ? WHERE id = ?').run(name, position, listId);

  const io = req.app.get('io');
  io.to(`board:${list.board_id}`).emit('list:updated', {
    boardId: list.board_id,
    list: { id: listId, name, position }
  });

  res.json({ list: { ...list, name, position } });
});

router.delete('/lists/:listId', (req, res) => {
  const { listId } = req.params;
  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'List not found' });
  if (!isMember(list.board_id, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }

  db.prepare('DELETE FROM lists WHERE id = ?').run(listId);

  const io = req.app.get('io');
  io.to(`board:${list.board_id}`).emit('list:deleted', { boardId: list.board_id, listId });

  res.status(204).end();
});

// ---- Cards ----

router.post('/lists/:listId/cards', (req, res) => {
  const { listId } = req.params;
  const { title, description } = req.body;

  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(listId);
  if (!list) return res.status(404).json({ error: 'List not found' });
  if (!isMember(list.board_id, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Card title is required' });
  }

  const maxPos = db
    .prepare('SELECT MAX(position) as maxPos FROM cards WHERE list_id = ?')
    .get(listId).maxPos;

  const card = {
    id: uuid(),
    list_id: listId,
    title: title.trim(),
    description: (description || '').trim(),
    position: (maxPos ?? -1) + 1
  };

  db.prepare(
    'INSERT INTO cards (id, list_id, title, description, position) VALUES (?, ?, ?, ?, ?)'
  ).run(card.id, card.list_id, card.title, card.description, card.position);

  const io = req.app.get('io');
  io.to(`board:${list.board_id}`).emit('card:created', { boardId: list.board_id, card });

  res.status(201).json({ card });
});

router.patch('/cards/:cardId', (req, res) => {
  const { cardId } = req.params;
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(card.list_id);
  if (!isMember(list.board_id, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }

  const updated = {
    title: req.body.title !== undefined ? req.body.title.trim() : card.title,
    description: req.body.description !== undefined ? req.body.description : card.description,
    position: req.body.position !== undefined ? req.body.position : card.position,
    list_id: req.body.list_id !== undefined ? req.body.list_id : card.list_id
  };

  // If moving to a different list, make sure the user has access to that list's board too
  let destBoardId = list.board_id;
  if (updated.list_id !== card.list_id) {
    const destList = db.prepare('SELECT * FROM lists WHERE id = ?').get(updated.list_id);
    if (!destList) return res.status(404).json({ error: 'Destination list not found' });
    if (!isMember(destList.board_id, req.userId)) {
      return res.status(403).json({ error: 'You are not a member of the destination board' });
    }
    destBoardId = destList.board_id;
  }

  db.prepare(
    'UPDATE cards SET title = ?, description = ?, position = ?, list_id = ? WHERE id = ?'
  ).run(updated.title, updated.description, updated.position, updated.list_id, cardId);

  const io = req.app.get('io');
  const payload = { boardId: destBoardId, card: { id: cardId, ...updated } };
  io.to(`board:${destBoardId}`).emit('card:updated', payload);
  if (destBoardId !== list.board_id) {
    io.to(`board:${list.board_id}`).emit('card:updated', payload);
  }

  res.json({ card: { id: cardId, ...updated } });
});

router.delete('/cards/:cardId', (req, res) => {
  const { cardId } = req.params;
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(card.list_id);
  if (!isMember(list.board_id, req.userId)) {
    return res.status(403).json({ error: 'You are not a member of this board' });
  }

  db.prepare('DELETE FROM cards WHERE id = ?').run(cardId);

  const io = req.app.get('io');
  io.to(`board:${list.board_id}`).emit('card:deleted', { boardId: list.board_id, cardId });

  res.status(204).end();
});

module.exports = router;

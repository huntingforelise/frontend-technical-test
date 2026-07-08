const fs = require('fs')
const path = require('path')
const dbPath = `${path.dirname(__filename)}/../db.json`

// Need this middleware to catch some requests
// and return both conversations where userId is sender or recipient
module.exports = (req, res, next) => {
  if (/conversations/.test(req.url) && req.method === 'GET') {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    const conversationId = Number(req.query?.id)
    const userIdFromQuery = Number(req.query?.senderId)
    const userIdFromPath = Number(req.url.match(/\/conversations\/(\d+)/)?.[1])
    const userId = Number.isInteger(userIdFromQuery)
      ? userIdFromQuery
      : userIdFromPath

    if (Number.isInteger(conversationId)) {
      res
        .status(200)
        .json(db?.conversations?.filter((conv) => conv.id === conversationId))
      return
    }

    if (!Number.isInteger(userId)) {
      res.status(200).json(db?.conversations ?? [])
      return
    }

    const result = db.conversations.filter(
      (conv) => conv.senderId == userId || conv.recipientId == userId
    )

    res.status(200).json(result)
    return
  }

  if (/messages/.test(req.url) && req.method === 'POST') {
    const conversationIdFromQuery = Number(req.query?.conversationId)
    const conversationIdFromPath = Number(req.url.match(/\/messages\/(\d+)/)?.[1])
    const conversationId = Number.isInteger(conversationIdFromQuery)
      ? conversationIdFromQuery
      : conversationIdFromPath

    if (Number.isInteger(conversationId)) {
      req.body = {
        ...req.body,
        conversationId,
      }
    }
  }

  next()
}

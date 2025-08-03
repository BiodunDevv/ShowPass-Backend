const express = require("express");
const router = express.Router();
const { requireAuth, isAdmin } = require("../middlewares/auth");
const {
  createArticle,
  getArticles,
  getFeaturedArticles,
  getArticleById,
  updateArticle,
  deleteArticle,
  toggleArticleLike,
  addComment,
  getArticleComments,
  addCommentReply,
  getArticleCategories,
  getArticlesByCategory,
} = require("../controllers/articleController");

// Public routes
router.get("/", getArticles);
router.get("/featured", getFeaturedArticles);
router.get("/categories", getArticleCategories);
router.get("/category/:category", getArticlesByCategory);
router.get("/:id", getArticleById);
router.get("/:id/comments", getArticleComments);

// Protected routes
router.use(requireAuth);

// Create article (Admin only)
router.post("/", createArticle);

// Update article (Admin only)
router.put("/:id", updateArticle);

// Delete article (Admin only)
router.delete("/:id", deleteArticle);

// Like/unlike article (Users and Organizers)
router.post("/:id/like", toggleArticleLike);

// Add comment to article (Users and Organizers)
router.post("/:id/comments", addComment);

// Add reply to comment (Users and Organizers)
router.post("/:id/comments/:commentId/replies", addCommentReply);

module.exports = router;

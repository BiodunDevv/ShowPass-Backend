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
  getArticleCategories,
  getArticlesByCategory,
} = require("../controllers/articleController");

// Public routes
router.get("/", getArticles);
router.get("/featured", getFeaturedArticles);
router.get("/categories", getArticleCategories);
router.get("/category/:category", getArticlesByCategory);
router.get("/:id", getArticleById);

// Protected routes
router.use(requireAuth);

// Create article (Admin only)
router.post("/", createArticle);

// Update article (Admin only)
router.put("/:id", updateArticle);

// Delete article (Admin only)
router.delete("/:id", deleteArticle);

// Like/unlike article
router.post("/:id/like", toggleArticleLike);

// Add comment to article
router.post("/:id/comments", addComment);

module.exports = router;

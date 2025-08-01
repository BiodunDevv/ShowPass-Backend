const Article = require("../models/Article");
const UserManager = require("../utils/UserManager");
const { sendSuccess, sendError, getPagination } = require("../utils/helpers");

// Create new article (Admin only)
const createArticle = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Only admins can create articles");
    }

    const {
      title,
      excerpt,
      content,
      image,
      author,
      category,
      tags,
      status = "published",
      featured = false,
      seo,
    } = req.body;

    // Validate required fields
    if (!title || !excerpt || !content || !image || !author || !category) {
      return sendError(res, 400, "All required fields must be provided");
    }

    const article = new Article({
      title,
      excerpt,
      content,
      image,
      author,
      authorId: req.user._id,
      category,
      tags: tags || [],
      status,
      featured,
      seo: seo || {},
    });

    await article.save();

    sendSuccess(res, "Article created successfully", article);
  } catch (error) {
    console.error("Create article error:", error);
    if (error.code === 11000) {
      sendError(res, 400, "Article with this title already exists");
    } else {
      sendError(res, 500, "Failed to create article", error.message);
    }
  }
};

// Get all articles with filtering and pagination
const getArticles = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const {
      category,
      featured,
      status = "published",
      search,
      author,
      sortBy = "publishedAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    let query = { status };

    if (category) {
      query.category = category;
    }

    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    if (author) {
      query.author = new RegExp(author, "i");
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const articles = await Article.find(query)
      .populate("authorId", "firstName lastName")
      .select("-content") // Exclude full content for listing
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments(query);

    sendSuccess(res, "Articles retrieved successfully", articles, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get articles error:", error);
    sendError(res, 500, "Failed to retrieve articles", error.message);
  }
};

// Get featured articles
const getFeaturedArticles = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const articles = await Article.find({
      status: "published",
      featured: true,
    })
      .populate("authorId", "firstName lastName")
      .select("-content")
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit));

    sendSuccess(res, "Featured articles retrieved successfully", articles);
  } catch (error) {
    console.error("Get featured articles error:", error);
    sendError(res, 500, "Failed to retrieve featured articles", error.message);
  }
};

// Get single article by ID or slug
const getArticleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by ID first, then by slug
    let article = await Article.findById(id).populate(
      "authorId",
      "firstName lastName"
    );

    if (!article) {
      article = await Article.findOne({ slug: id }).populate(
        "authorId",
        "firstName lastName"
      );
    }

    if (!article) {
      return sendError(res, 404, "Article not found");
    }

    // Only show published articles to non-admins
    if (article.status !== "published" && req.user?.role !== "admin") {
      return sendError(res, 404, "Article not found");
    }

    // Increment view count
    article.views += 1;
    await article.save();

    sendSuccess(res, "Article retrieved successfully", article);
  } catch (error) {
    console.error("Get article error:", error);
    sendError(res, 500, "Failed to retrieve article", error.message);
  }
};

// Update article (Admin only)
const updateArticle = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Only admins can update articles");
    }

    const { id } = req.params;
    const updates = req.body;

    const article = await Article.findById(id);
    if (!article) {
      return sendError(res, 404, "Article not found");
    }

    // Update allowed fields
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && key !== "_id" && key !== "authorId") {
        article[key] = updates[key];
      }
    });

    await article.save();

    sendSuccess(res, "Article updated successfully", article);
  } catch (error) {
    console.error("Update article error:", error);
    sendError(res, 500, "Failed to update article", error.message);
  }
};

// Delete article (Admin only)
const deleteArticle = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Only admins can delete articles");
    }

    const { id } = req.params;

    const article = await Article.findById(id);
    if (!article) {
      return sendError(res, 404, "Article not found");
    }

    await Article.findByIdAndDelete(id);

    sendSuccess(res, "Article deleted successfully", {
      articleTitle: article.title,
    });
  } catch (error) {
    console.error("Delete article error:", error);
    sendError(res, 500, "Failed to delete article", error.message);
  }
};

// Like/Unlike article
const toggleArticleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userType = req.user.userType;

    const article = await Article.findById(id);
    if (!article) {
      return sendError(res, 404, "Article not found");
    }

    const existingLikeIndex = article.likes.findIndex(
      (like) => like.user.toString() === userId.toString()
    );

    if (existingLikeIndex > -1) {
      // Unlike
      article.likes.splice(existingLikeIndex, 1);
    } else {
      // Like
      article.likes.push({
        user: userId,
        userType: userType,
      });
    }

    await article.save();

    sendSuccess(res, "Article like status updated", {
      liked: existingLikeIndex === -1,
      totalLikes: article.likes.length,
    });
  } catch (error) {
    console.error("Toggle article like error:", error);
    sendError(res, 500, "Failed to update like status", error.message);
  }
};

// Add comment to article
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user._id;
    const userType = req.user.userType;
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    if (!content || content.trim().length === 0) {
      return sendError(res, 400, "Comment content is required");
    }

    const article = await Article.findById(id);
    if (!article) {
      return sendError(res, 404, "Article not found");
    }

    const comment = {
      user: userId,
      userType: userType,
      userName: userName,
      content: content.trim(),
    };

    article.comments.push(comment);
    await article.save();

    sendSuccess(res, "Comment added successfully", {
      comment: article.comments[article.comments.length - 1],
      totalComments: article.comments.length,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    sendError(res, 500, "Failed to add comment", error.message);
  }
};

// Get article categories
const getArticleCategories = async (req, res) => {
  try {
    const categories = [
      "Marketing",
      "Technology",
      "Community",
      "Business",
      "Entertainment",
      "Education",
      "Health",
      "Sports",
      "Finance",
      "Travel",
      "Food",
      "Fashion",
      "Lifestyle",
      "News",
      "Tips",
    ];

    sendSuccess(res, "Article categories retrieved successfully", categories);
  } catch (error) {
    console.error("Get categories error:", error);
    sendError(res, 500, "Failed to retrieve categories", error.message);
  }
};

// Get articles by category
const getArticlesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page, limit, skip } = getPagination(req);

    const articles = await Article.find({
      category: category,
      status: "published",
    })
      .populate("authorId", "firstName lastName")
      .select("-content")
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments({
      category: category,
      status: "published",
    });

    sendSuccess(
      res,
      `Articles in ${category} category retrieved successfully`,
      articles,
      {
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    );
  } catch (error) {
    console.error("Get articles by category error:", error);
    sendError(
      res,
      500,
      "Failed to retrieve articles by category",
      error.message
    );
  }
};

module.exports = {
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
};

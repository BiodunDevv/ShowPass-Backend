const mongoose = require("mongoose");

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Article title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    excerpt: {
      type: String,
      required: [true, "Article excerpt is required"],
      maxlength: [500, "Excerpt cannot exceed 500 characters"],
    },
    content: {
      type: String,
      required: [true, "Article content is required"],
    },
    image: {
      type: String,
      required: [true, "Article image is required"],
    },
    author: {
      type: String,
      required: [true, "Author name is required"],
      trim: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    readTime: {
      type: String,
      default: "5 min read",
    },
    category: {
      type: String,
      required: [true, "Article category is required"],
      enum: [
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
      ],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "likes.userType",
        },
        userType: {
          type: String,
          enum: ["Admin", "Organizer", "RegularUser"],
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "comments.userType",
        },
        userType: {
          type: String,
          enum: ["Admin", "Organizer", "RegularUser"],
        },
        userName: String,
        content: {
          type: String,
          required: true,
          maxlength: [1000, "Comment cannot exceed 1000 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        replies: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              refPath: "comments.replies.userType",
            },
            userType: {
              type: String,
              enum: ["Admin", "Organizer", "RegularUser"],
            },
            userName: String,
            content: {
              type: String,
              required: true,
              maxlength: [500, "Reply cannot exceed 500 characters"],
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },
    publishedAt: Date,
    lastModified: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to generate slug
articleSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  }

  // Set published date if status changes to published
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  // Auto-calculate read time based on content
  if (this.isModified("content")) {
    const wordsPerMinute = 200;
    const wordCount = this.content.split(/\s+/).length;
    const readTimeMinutes = Math.ceil(wordCount / wordsPerMinute);
    this.readTime = `${readTimeMinutes} min read`;
  }

  this.lastModified = new Date();
  next();
});

// Virtual for total likes
articleSchema.virtual("totalLikes").get(function () {
  return this.likes ? this.likes.length : 0;
});

// Virtual for total comments
articleSchema.virtual("totalComments").get(function () {
  if (!this.comments) return 0;
  const mainComments = this.comments.length;
  const replyComments = this.comments.reduce((total, comment) => {
    return total + (comment.replies ? comment.replies.length : 0);
  }, 0);
  return mainComments + replyComments;
});

// Ensure virtual fields are serialized
articleSchema.set("toJSON", { virtuals: true });

// Index for search optimization
articleSchema.index({ title: "text", content: "text", excerpt: "text" });
articleSchema.index({ category: 1, status: 1 });
articleSchema.index({ featured: 1, status: 1 });
articleSchema.index({ publishedAt: -1 });

module.exports = mongoose.model("Article", articleSchema);

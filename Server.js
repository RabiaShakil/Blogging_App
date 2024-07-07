const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

mongoose.connect('mongodb://127.0.0.1/Assignment3', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// User Schema and Model
const users = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
});

const User = mongoose.model('User', users);

// Blog Post Schema and Model
const blogs = new mongoose.Schema({
  blogtitle: {
    type: String,
    required: true,
  },
  blogcontent: {
    type: String,
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  comments: [
    {
      text: String,
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
});

const BlogPost = mongoose.model('BlogPost', blogs);

// Authentication Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decodedToken = jwt.verify(token, 'secret-key');
    req.userId = decodedToken.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// User Registration
app.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this name or email already exists' });
    }

    const newUser = new User({
      username,
      password,
      email,
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'User Registration Failed.' });
  }
});

// User Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Incorrect username or password' });
    }

    if (password !== user.password) {
      return res.status(400).json({ message: 'Incorrect username or password' });
    }

    const token = jwt.sign({ userId: user._id }, 'secret-key');

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Failed to login' });
  }
});

// Update user information
app.put('/users/:id', authMiddleware, async (req, res) => {
  try {
    const { username, email } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User with this name not found' });
    }

    if (user._id.toString() !== req.userId) {
      return res.status(403).json({ message: 'You are not allowed to update this user' });
    }

    user.username = username;
    user.email = email;

    await user.save();

    res.status(200).json({ message: 'User information updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user information' });
  }
});

// Create a new blog post
app.post('/blogposts', authMiddleware, async (req, res) => {
  try {
      const { blogtitle, blogcontent } = req.body;
      const author = req.userId;

      const newBlogPost = new BlogPost({
        blogtitle,
        blogcontent,
          author,
      });

      await newBlogPost.save();

      res.status(201).json({ message: 'Blog post created successfully' });
  } catch (error) {
      res.status(500).json({ message: 'Failed to create blog post' });
  }
});

// Get all blog posts
app.get('/blogposts', async (req, res) => {
  try {
      const blogPosts = await BlogPost.find().populate('author', 'username');

      res.status(200).json(blogPosts);
  } catch (error) {
      res.status(500).json({ message: 'Failed to get blog posts' });
  }
});

// Get a single blog post by ID
app.get('/blogposts/:id', async (req, res) => {
  try {
      const blogPost = await BlogPost.findById(req.params.id).populate('author', 'username');

      if (!blogPost) {
          return res.status(404).json({ message: 'Blog post not found' });
      }

      res.status(200).json(blogPost);
  } catch (error) {
      res.status(500).json({ message: 'Failed to get blog post' });
  }
});

// Update a blog post
app.put('/blogposts/:id', authMiddleware, async (req, res) => {
  try {
      const { blogtitle, blogcontent } = req.body;

      const blogPost = await BlogPost.findById(req.params.id);

      if (!blogPost) {
          return res.status(404).json({ message: 'No Blog post found' });
      }

      if (blogPost.author.toString() !== req.userId) {
          return res.status(403).json({ message: 'You are not allowed to update this blog post' });
      }

      blogPost.blogtitle = blogtitle;
      blogPost.blogcontent = blogcontent;

      await blogPost.save();

      res.status(200).json({ message: 'Blog post updated successfully' });
  } catch (error) {
      res.status(500).json({ message: 'Failed to update blog post' });
  }
});

// Delete a blog post
app.delete('/blogposts/:id', authMiddleware, async (req, res) => {
  try {
    const blogPost = await BlogPost.findById(req.params.id);

    if (!blogPost) {
      return res.status(404).json({ message: 'No Blog post found' });
    }

    if (blogPost.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'You are not allowed to delete this blog post' });
    }

    await blogPost.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete blog post' });
  }
});


// Add a comment to a blog post
app.post('/blogposts/:id/comments', authMiddleware, async (req, res) => {
  try {
      const { text } = req.body;

      const blogPost = await BlogPost.findById(req.params.id);

      if (!blogPost) {
          return res.status(404).json({ message: 'No Blog post found' });
      }

      const comment = {
        text,
        author: req.userId,
    };

    blogPost.comments.push(comment);
    await blogPost.save();

    res.status(201).json({ message: 'Comment added successfully' });
} catch (error) {
    res.status(500).json({ message: 'Failed to add comment' });
}
});

// Start the server
const port = 3000;
app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
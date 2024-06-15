require('dotenv').config();  // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const monk = require('monk');
const yup = require('yup');
const helmet = require('helmet');
const { nanoid } = require('nanoid');

const app = express();

const db = monk(process.env.MONGO_URI);
const urls = db.get('url');
urls.createIndex({ slug: 1 }, { unique: true });

// Middleware
app.use(helmet());
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json());
app.use(express.static('./public'));

// Schema
const schema = yup.object().shape({
    slug: yup.string().trim().matches(/[\w\-]/i),
    url: yup.string().trim().url().required(),
});

// Requests
app.post('/url', async (req, res, next) => {
    let { slug, url } = req.body;
    try {
        await schema.validate({ slug, url });
        if (!slug) {
            slug = nanoid(5);
        } else {
            const existing = await urls.findOne({ slug });
            if (existing) {
                throw new Error('Slug in use!');
            }
        }
        slug = slug.toLowerCase();
        const newUrl = { url, slug };
        const created = await urls.insert(newUrl);
        res.json(created);
    } catch (error) {
        if (error.message.startsWith('E1100')) {
            error.message = "Slug in use 🥲";
        }
        next(error);
    }
});

app.use((error, req, res, next) => {
    if (error.status) {
        res.status(error.status);
    } else {
        res.status(500);
    }
    res.json({
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? '🥲' : error.stack,
    });
});

app.get('/:id', async (req, res) => {
    const { id: slug } = req.params;
    try {
        const url = await urls.findOne({ slug });
        if (url) {
            return res.redirect(url.url);
        }
        res.status(404).redirect(`/?error=${slug} not found`);
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).redirect(`/?error=Server error`);
    }
});


const port = process.env.PORT || 1337;
app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});

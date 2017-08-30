var express = require('express');
var loki = require('lokijs');
var bodyParser = require('body-parser');
var shortid = require('shortid');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var md5 = require('md5');
var dialog = require('dialog');

// express 設定

var app = express();


// 設定靜態資源資料夾
app.use(express.static(__dirname + '/www'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.use('/assets', express.static(__dirname + '/assets'));

// 接收表單資料
app.use(bodyParser.urlencoded({
    extended: true
}));


app.use(cookieParser());
app.use(cookieSession({
    key: "node",
    secret: shortid.generate()
}));

// 設定模板引擎
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// 初始化資料庫
var db = new loki('blog.json', {
    autosave: true,
    autosaveInterval: 5000,
    autoload: true,
    autoloadCallback: initializeCollections
});

var users, articles, categories, comments;

function initializeCollection(name) {
    var collection = db.getCollection(name);
    if (!collection)
        collection = db.addCollection(name);
    return collection;
}

function initializeCollections() {
    users = initializeCollection('users');
    articles = initializeCollection('articles');
    categories = initializeCollection('categories');
    comments = initializeCollection('comments');
}

app.get('/', function (req, res) {
    res.locals.articles = articles.data;
    res.locals.categories = categories.data;
    res.render('home');
});

app.get('/register', function (req, res) {
    app.locals.path = req.path;
    res.render('registration');
});

app.post('/register', function (req, res) {
    var acc = users.findOne({
        account: req.body.account
    });
    var email = users.findOne({
        email: req.body.email
    });
    var user = {
        account: req.body.account,
        email: req.body.email,
        password: md5(req.body.password),
        valid: "N"
    };

    if (acc || email) {
        dialog.info('帳號或email已存在', '提示');
        res.redirect('/register');
    } else {
        users.insert(user);
        res.redirect('/login');
    }
    res.end();
});

app.get('/login', function (req, res) {
    if (users.data.length === 0) {
        res.redirect('/register');
    } else {
        res.locals.path = req.path;
        res.render('registration');
    }
});

app.post('/login', function (req, res) {
    var user = users.findOne({
        account: req.body.account,
        password: md5(req.body.password)
    });

    if (user) {
        if (user.valid == "Y") {
            req.session.logined = true;
            req.session.username = user.account;

            res.redirect('/admin');
        } else {
            dialog.info('權限尚未審核通過', '警告');
            res.redirect('/login');
        }
    } else {
        dialog.info('帳號或密碼不正確', '警告');
        res.redirect('/login');
    }
});

app.get('/logout', function (req, res) {
    req.session.logined = false;
    req.session.username = null;
    res.redirect('/login');
});

function auth(req, res, next) {
    if (!req.session.logined || !req.session.username) {
        console.log('session錯誤，重新導向login');
        res.redirect('/login');
        res.end();
    } else {
        app.locals.logined = req.session.logined;
        app.locals.username = req.session.username;

        next();
    }
}

// router 定義路由

var adminRouter = express.Router();

adminRouter.use(auth);

adminRouter.get('/', function (req, res) {
    res.render('admin/dashboard.ejs');
});

adminRouter.get('/articles', function (req, res) {
    res.locals.articles = articles.data;
    res.render('admin/articles/list');
});

app.locals.sitename = "Front-End 282";

adminRouter.get('/articles/add', function (req, res) {
    res.locals.categories = categories.data;
    res.render('admin/articles/add');
    res.end();
});

adminRouter.post('/articles/add', function (req, res) {
    var article = {
        shortUrl: shortid.generate(),
        title: req.body.title,
        category: req.body.category,
        content: req.body.content,
        images: req.body.images
    };

    articles.insert(article);
    res.redirect('/admin/articles');
    res.end();
});

adminRouter.get('/articles/edit/:id', function (req, res) {
    var article = articles.findOne({
        shortUrl: req.params.id
    });

    if (!article) {
        res.send("查無資料");
    } else {
        res.locals.article = article;
        res.locals.categories = categories.data;

        res.render('admin/articles/edit');
    }
});

adminRouter.post('/articles/edit/:id', function (req, res) {
    var article = articles.findOne({
        shortUrl: req.params.id
    });

    article.title = req.body.title;
    article.category = req.body.category;
    article.content = req.body.content;
    article.images = req.body.images;

    articles.update(article);
    res.redirect('/admin/articles/edit/' + article.shortUrl);
});

adminRouter.get('/categories', function (req, res) {
    res.render('admin/categories/list', {
        categories: categories.data
    });
    res.end();
});

adminRouter.get('/categories/add', function (req, res) {
    res.render('admin/categories/add');
    res.end();
});

adminRouter.post('/categories/add', function (req, res) {
    var category = {
        id: shortid.generate(),
        name: req.body.name,
        description: req.body.description
    };

    categories.insert(category);

    res.redirect('/admin/categories');
    res.end();
});

adminRouter.get('/categories/edit/:id', function (req, res) {
    var category = categories.findOne({
        id: req.params.id
    });

    res.render('admin/categories/edit', {
        category: category
    });
    res.end();
});

adminRouter.post('/categories/edit/:id', function (req, res) {
    var category = categories.findOne({
        id: req.params.id
    });
    var _articles = articles.find({
        category: category.name
    });
    category.name = req.body.name;
    category.description = req.body.description;

    _articles.forEach(function (article) {
        article.category = category.name;
        articles.update(article);
    }, this);

    categories.update(category);

    res.redirect('/admin/categories');

    res.end();
});

adminRouter.get('/categories/delete/:id', function (req, res) {
    var category = categories.findOne({
        id: req.params.id
    });

    categories.remove(category);

    res.redirect('/admin/categories');
    res.end();
});

adminRouter.get('/users', function (req, res) {
    res.render('admin/users/list', {
        users: users.data
    });
    res.end();
});

adminRouter.get('/users/add', function (req, res) {
    res.render('admin/users/add');
    res.end();
});

adminRouter.post('/users/add', function (req, res) {
    var user = {
        account: req.body.account,
        email: req.body.email,
        password: md5(req.body.password),
        valid: req.body.valid
    };

    users.insert(user);

    res.redirect('/admin/users');
    res.end();
});

adminRouter.get('/users/edit/:id', function (req, res) {
    var user = users.findOne({
        account: req.params.id
    });

    res.render('admin/users/edit', {
        user: user
    });
    res.end();
});

adminRouter.post('/users/edit/:id', function (req, res) {
    var user = users.findOne({
        account: req.params.id
    });
    user.email = req.body.email;
    user.valid = req.body.valid;

    users.update(user);

    res.redirect('/admin/users');

    res.end();
});

adminRouter.get('/users/delete/:id', function (req, res) {
    var user = users.findOne({
        account: req.params.id
    });

    users.remove(user);

    res.redirect('/admin/users');
    res.end();
});

app.use('/admin', adminRouter);

app.listen(1234);
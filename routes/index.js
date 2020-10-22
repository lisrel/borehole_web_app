var express = require('express');
var router = express.Router();
var session = require('express-session');
var User = require('../public/javascripts/users');
var GeoJSON = require('../public/javascripts/geojson.min.js');
var dbgeo = require('dbgeo');
var GeoJSON = require('geojson');
var jquery = require('jquery');
var flash  = require('req-flash');
const { body, check, validationResult } = require('express-validator');

var sessionChecker = (req, res, next) => {
	if (req.session.user && req.cookies.user_sid) {
		res.redirect('/dashboard');
	} else {
		next();
	}
};

const {
	Client,
	Query
} = require('pg');

const pg = require('pg');

router.use(flash());
var sess;


var username = "postgres";
var password = "postgres";
var host = "127.0.0.1:5432";
var database = "boreholes";
var conString = "postgres://" + username + ":" + password + "@" + host + "/" + database;

const boreholes = "SELECT row_to_json(fc) " +
"FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) " +
"As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, " +
"row_to_json((b_name, b_type, b_status, b_descript,gid))" +
" As boreholes FROM final_boreholes As lg) As f) As fc ";

const cadastral = "SELECT row_to_json(fc) " +
"FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) " +
"As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, " +
"row_to_json((stand_id, street_ad, acc_no, acc_name, town,gid))" +
" As properties FROM properties As lg) As f) As fc ";

router.get('/', sessionChecker, (req, res,next) => {
	res.redirect('dashboard');
});

router.get('/signup', (req, res, next) => {
	res.render('signup',  { flash: req.flash() });
})

router.get('/login', (req, res, next) => {
	res.render('login', { flash: req.flash() });
})

router.route('/signup')
.get(sessionChecker, (req, res) => {
	res.render('signup');
})
.post( [
	check('email', ).isEmail().withMessage('Email must be a valid email address').not().isEmpty().withMessage('Email can not be empty'),
	check('username', 'Username must have at least be 6 characters long').isLength({ min: 6 }),
	check('password', ).isLength({ min: 8 }).withMessage('Password must have at least be 8 characters long').matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/, "i").withMessage('Password should be combination of one uppercase , one lower case, one special char, one digit and min 8 , max 20 char long'),
	
	body('username')
	.trim()
	.escape(),
	body('password')
	.trim()
	.escape()
], (req, res) => {
	
	var password_1 = req.body.password;
	var password_2 = req.body.confirm_password;
	var username = req.body.username,
	email = req.body.email;
	
	// Finds the validation errors in this request and wraps them in an object with handy functions
	const errors = validationResult(req);
	var listss = errors['errors'];
	var lists = [];
	var index;
	
	for (index = 0; index < listss.length; ++index) {
		lists.push(listss[index]['msg']);
	}
	var validation_error = lists.toString();
	
	validation_error = validation_error.replace(',', ", ");
	
	if (!errors.isEmpty()) {
		req.flash('error', validation_error);
		return res.redirect('/signup');
	}
	
	
	//check if email and username are unique
	User.findOne({ where: { username: username } }).then(function(user) {
		if (!user) {
			User.findOne({ where: { email: email } }).then(function(user) {
				if (!user) {
					
					//check if password are matching
					if( password_1 === password_2){
						User.create({
							username: req.body.username,
							email: req.body.email,
							password: req.body.password
						})
						.then(user => {
							req.session.user = user.dataValues;
							res.redirect('/login');
						})
						.catch(error => {
							req.flash('error', 'An Error Occurred while signing up '+ error);
							res.redirect('/signup');
							
						});
					}else{
						req.flash('error', 'The passwords do not match.');
						res.redirect('/signup');
					}
					
					
				} else {
					req.flash('error', 'The email address you have entered is already registered,  please login or use a different one to register.');
					res.redirect('/signup');
				}
			});
			
		} else {
			req.flash('error', 'The username you have entered is already registered,  please login or use a different one to register.');
			res.redirect('/signup');
		}
	});
	
	
	
});

router.route('/login')
.get(sessionChecker, (req, res) => {
	res.render('login');
})
.post([
	body('username')
	.trim()
	.escape(),
	body('password')
	.trim()
	.escape()
],(req, res) => {
	var username = req.body.username,
	password = req.body.password;
	
	User.findOne({ where: { username: username } }).then(function(user) {
		console.log('user'+User);
		if (!user) {
			req.flash('error', 'The username and password do not match.');
			res.redirect('/login');
		} else if (!user.validPassword(password)) {
			req.flash('error', 'The username and password do not match.');
			res.redirect('/login');
		} else {
			req.session.user = user.dataValues;
			sess = req.session.user;
			res.redirect('dashboard');
		}
	});
});

// route for user's dashboard
router.get('/dashboard', (req, res, next) => {
	if (req.session.user && req.cookies.user_sid) {
		sess = req.session.user;
		// console.log('hello', sess);
		res.render('dashboard', {data:sess});
		
	} else {
		res.redirect('/login');
	}
});

// route for user logout
router.get('/logout', (req, res) => {
	if (req.session.user && req.cookies.user_sid) {
		res.clearCookie('user_sid');
		res.redirect('/');
	} else {
		res.redirect('/login');
	}
});

router.get('/api/parcels', function(req, res) {
	let query;
	sess = req.session.user;
	const client = new Client(conString);
	client.connect();
	query = client.query(new Query(cadastral));
	
	query.on("row", function(row, result) {
		result.addRow(row);
	});
	query.on("end", function(result) {
		res.send(result.rows[0].row_to_json);
		res.end();
	});
	//client.end();
});

router.get('/api/boreholes', function(req, res) {
	let query;
	sess = req.session.user;
	const client = new Client(conString);
	client.connect();
	query = client.query(new Query(boreholes));
	
	query.on("row", function(row, result) {
		result.addRow(row);
	});
	query.on("end", function(result) {
		res.send(result.rows[0].row_to_json);
		res.end();
	});
	//client.end();
});


router.get('/api/parcel/:id', function(req, res) {
	var url = req.url;
	url = url.split("/").pop();
	let query;
	sess = req.session.user;
	const client = new Client(conString);
	client.connect();
	
	const cadastral_sql = "	SELECT row_to_json(fc) " +
	"FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) " +
	"As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, " +
	"row_to_json((b_name, b_type, b_status, b_descript,gid))" +
	" As boreholes FROM final_boreholes As lg WHERE gid ="+url+") As f) As fc  ";
	query = client.query(new Query(cadastral_sql));
	
	query.on("row", function(row, result) {
		result.addRow(row);
	});
	query.on("end", function(result) {
		res.send(result.rows[0].row_to_json);
		res.end();
	});
	//client.end();
});

router.get('/api/prop_num', function(req, res) {
	var url = req.url;

	let query;
	sess = req.session.user;
	const client = new Client(conString);
	client.connect();
	const cadastral_sql = "SELECT count(gid) as num FROM properties ";
	console.log(cadastral_sql);
	query = client.query(new Query(cadastral_sql));
	
	
	query.on("end", function(result) {
		res.send(result.rows[0]);
		res.end();
	});
	//client.end();
});

router.get('/api/allocated_num', function(req, res) {
	var url = req.url;
	url = url.split("/").pop();

	let query;
	sess = req.session.user;
	const client = new Client(conString);
	client.connect();
	const cadastral_sql = "SELECT count(*) as num FROM final_boreholes where b_status != 'Not working' ";
	console.log(cadastral_sql);
	query = client.query(new Query(cadastral_sql));
	
	
	query.on("end", function(result) {
		res.send(result.rows[0]);
		res.end();
	});
	//client.end();
});

router.get('/api/unallocated_num/', function(req, res) {
	var url = req.url;
	url = url.split("/").pop();

	let query;
	sess = req.session.user;
	const client = new Client(conString);
	client.connect();
	const cadastral_sql = "SELECT count(*) as num FROM final_boreholes ";
	console.log(cadastral_sql);
	query = client.query(new Query(cadastral_sql));
	
	
	query.on("end", function(result) {
		res.send(result.rows[0]);
		res.end();
	});
	//client.end();
});

// route for user's dashboard
router.post('/save_info', (req, res, next) => {
	if (req.session.user && req.cookies.user_sid) {
		console.log(req.body);
		let query;
		const client = new Client(conString);
		client.connect();
		const update_sql = "UPDATE final_boreholes set b_name='"+req.body.street_ad
		+"',b_type='"+req.body.street_number +"', b_status='"+req.body.acc_num
		+"', b_descript='"+req.body.acc_name+"' WHERE gid="+req.body.table_id;
		query = client.query(new Query(update_sql));
		console.log(update_sql);
		query.on("end", function(result) {
			var obj = 'Update successful';
			res.send(JSON.stringify(obj));
			res.end();
		});
		
	} else {
		res.redirect('/login');
	}
});


router.get('/api/allparcels', (req, res, next) => {
	const results = [];
	// Get a Postgres client from the connection pool
	pg.connect(conString, (err, client, done) => {
		// Handle connection errors
		if(err) {
			done();
			console.log(err);
			return res.status(500).json({success: false, data: err});
		}
		// SQL Query > Select Data
		const query = client.query('SELECT * FROM lgs  where user_location is null ORDER BY id ASC;');
		// Stream results back one row at a time
		query.on('row', (row) => {
			results.push(row);
		});
		// After all data is returned, close connection and return results
		query.on('end', () => {
			done();
			return res.json(results);
		});
	});
});


module.exports = router;
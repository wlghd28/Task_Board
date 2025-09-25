const   fs          = require('fs');
const   express     = require('express');
const   ejs         = require('ejs');
const   mysql       = require('mysql');
const   bodyParser  = require('body-parser');
const   methodOverride = require('method-override');
const   url = require('url');
//const   session     = require('express-session');
const   router      = express.Router();
//const   requestIp   = require('request-ip');
//const   moment      = require('moment');
const   async       = require('async');

require('moment-timezone');
router.use(methodOverride('_method'));
router.use(bodyParser.urlencoded({ extended: false }));


/* 
    데이터베이스 연동 소스코드 
*/
var db = mysql.createConnection({
    host:       'localhost',        // DB서버 IP주소
    port:       3306,               // DB서버 Port주소
    user:       'root',             // DB접속 아이디
    password:   'root',             // DB암호
    database:   'Task_Board'        //사용할 DB명
});

function HandleDisconnectDB() {
    db = mysql.createConnection({       // Recreate the connection, since
        host:       'localhost',        // DB서버 IP주소
        port:       3306,               // DB서버 Port주소
        user:       'root',             // DB접속 아이디
        password:   'root',             // DB암호
        database:   'Task_Board'        //사용할 DB명
    });

    // the old one cannot be reused.
    db.connect(function(err) {              // The server is either down
        if(err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(HandleDisconnectDB, 2000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
    });                                         // process asynchronous requests in the meantime.

    // If you're also serving http, display a 503 error.
    db.on('error', function(err) {
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            HandleDisconnectDB();                         // lost due to either server restart, or a
        } else {                                        // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });

}

HandleDisconnectDB();

/*
    주간 보고서 작성 양식
*/
const Write_WeeklyReport_UI = (req, res) => {
    if (req.session.userid) {  
        let start_date, end_date;
        let date_org = new Date();
        let date_temp = new Date();
        let day = date_org.getDay();
        date_temp.setDate(date_org.getDate() - day);
        start_date = date_temp.getFullYear() + "-" + ("0" + (date_temp.getMonth() + 1)).slice(-2) + "-" + ("0" + (date_temp.getDate())).slice(-2);
        date_temp.setDate(date_temp.getDate() + 6);
        end_date = date_temp.getFullYear() + "-" + ("0" + (date_temp.getMonth() + 1)).slice(-2) + "-" + ("0" + (date_temp.getDate())).slice(-2);

        //console.log(start_date);
        //console.log(end_date);

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/report_weekly_write_form.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        let sql_str_note = "";
        let sql_str_report = "";

        sql_str_note += "SELECT ";
        sql_str_note += "DATE_FORMAT(note_date,'%Y-%m-%d'),";
        sql_str_note += "note_imagetext1, note_imagetext2, note_imagetext3, note_imagetext4, note_imagetext5, note_imagetext6, note_imagetext7, note_imagetext8, note_imagetext9, note_imagetext10,";
        sql_str_note += "note_text ";
        sql_str_note += "FROM NOTE WHERE note_userid = ? and DATE_FORMAT(note_date,'%Y-%m-%d') >= ? and DATE_FORMAT(note_date,'%Y-%m-%d') <= ?";

        sql_str_report += "SELECT * FROM REPORT WHERE report_userid = ? and DATE_FORMAT(report_date,'%Y-%m-%d') >= ? and DATE_FORMAT(report_date,'%Y-%m-%d') <= ?" 

        let results_note, results_report;
        async.waterfall([
            function(callback) {
                db.query(sql_str_note, [req.session.userid, start_date, end_date], (error, results) => {
                    if (error) {     
                        console.log(error);
                        callback(error);
                    } else {
                        results_note = results.reverse();
                        callback(null);
                    }
                });
            },
            function(callback) {
                db.query(sql_str_report, [req.session.userid, start_date, end_date], (error, results) => {
                    if(error) {
                        console.log(error);
                        callback(error);
                    } else {
                        results_report = results.reverse();
                        callback(null);
                    }
                });               
            },
            function(callback) {
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../',
                    Note            :results_note,
                    Report          :results_report[0]
                }));
                callback(null);
            }],
            function(error, result) {
                if (error) 
                {
                    console.log(error);
                    res.end(JSON.stringify(error));
                }
            }
        );
    } else {
        res.redirect('/');
    }
};


/*
    주간 보고서 등록
*/
const Upload_WeeklyReport = (req, res) => {
    if (req.session.userid) {  
        let body = req.body;    

        let start_date, end_date;
        let report_date = new Date();
        let date_temp = new Date();
        let day = report_date.getDay();
        date_temp.setDate(report_date.getDate() - day);
        start_date = date_temp.getFullYear() + "-" + ("0" + (date_temp.getMonth() + 1)).slice(-2) + "-" + ("0" + (date_temp.getDate())).slice(-2);
        date_temp.setDate(date_temp.getDate() + 6);
        end_date = date_temp.getFullYear() + "-" + ("0" + (date_temp.getMonth() + 1)).slice(-2) + "-" + ("0" + (date_temp.getDate())).slice(-2);
        
        
        let report_userid = req.session.userid;
        let report_username = req.session.who;
        let report_userlevel = req.session.level;
        let report_userteam = req.session.team;

        //console.log(body);

        let str_sql_search = "SELECT * FROM REPORT WHERE report_userid = ? and DATE_FORMAT(report_date,'%Y-%m-%d') >= ? and DATE_FORMAT(report_date,'%Y-%m-%d') <= ?";

        // 이전에 작성된 보고서가 있는지 조사
        db.query(str_sql_search , [req.session.userid, start_date, end_date], (error, results) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
                // 작성된 보고서가 있으면 데이터 수정
                if(results.length > 0)
                {
                    let str_sql_update = "UPDATE REPORT SET report_date = ?, report_text = ? WHERE report_userid = ? and DATE_FORMAT(report_date,'%Y-%m-%d') >= ? and DATE_FORMAT(report_date,'%Y-%m-%d') <= ?";
                    db.query(str_sql_update , [report_date, body.report, report_userid, start_date, end_date], (error) => {
                        if (error) {     
                            console.log(error);
                            res.end("error");
                        } else {
                            console.log("보고서 DB수정 성공!!");
                            res.redirect('/report/week');    
                        }
                    });

                }
                // 작성된 보고서가 없으면 데이터 삽입
                else
                {
                    let str_sql_insert = "INSERT INTO REPORT(report_userid, report_username, report_userlevel, report_userteam, report_type, report_date, report_text) VALUES(? ,?, ?, ?, ?, ?, ?)";

                    db.query(str_sql_insert , [report_userid, report_username , report_userlevel, report_userteam, 0, report_date, body.report], (error) => {
                        if (error) {     
                            console.log(error);
                            res.end("error");
                        } else {
                            console.log("보고서 DB삽입 성공!!");
                            res.redirect('/report/week');    
                        }
                    });
                }
            }
        });

    } else {
        res.redirect('/');
    }
};



/*
    월간 보고서 작성 양식
*/
const Write_MonthlyReport_UI = (req, res) => {
    if (req.session.userid) {  
        
    } else {
        res.redirect('/');
    }
};


/*
    월간 보고서 등록
*/
const Upload_MonthlyReport = (req, res) => {
    if (req.session.userid) {  
        
    } else {
        res.redirect('/');
    }
};




/*
    보고서 리스트 UI
*/
const ReportListUI = (req, res) => {
    if (req.session.userid) {  
        let report_userlevel = req.session.level;
        let report_userteam = req.session.team;

        // // 3개월 전 날짜를 구한다.
        // let date = new Date();
        // let before_date = new Date();   
        // before_date.setDate(date.getDate() - 92);
        // let str_date = before_date.getFullYear() + "-" + ("0" + (before_date.getMonth() + 1)).slice(-2) + "-" + ("0" + (before_date.getDate())).slice(-2);


        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/report_list.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});


        let sql_str = "";
        sql_str += "SELECT report_userid, report_username, report_userlevel, report_userteam, DATE_FORMAT(report_date,'%Y-%m-%d'), report_text FROM REPORT WHERE report_userlevel < ? and report_userteam = ? ORDER BY report_date DESC Limit 5000"

        db.query(sql_str, [report_userlevel, report_userteam], (error, results) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
                //console.log(results);
                res.end(ejs.render(HtmlPageStream, {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../',
                    List            :results
                }));
                
            }
        });
    } else {
        res.redirect('/');
    }
};

/*
    보고서 내용 조회
*/
const ReportContentUI = (req, res) => {
    if(req.session.userid) {
        const  query = url.parse(req.url, true).query;
        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/report_content.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});


        //console.log(query.date);

        let sql_str = "SELECT * FROM REPORT WHERE report_userid = ? and DATE_FORMAT(report_date,'%Y-%m-%d') = ?";


        db.query(sql_str, [query.userid, query.date], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {
                //console.log(results);
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../../',
                    name            :query.username,
                    Content         :results[0]
                }));
            }
        });

    } else {
        res.redirect('/');
    }
};


/*
    보고서 검색
*/

const SimpleSearchReport = (req, res) => {
    if(req.session.userid) {
        let report_userlevel = req.session.level;
        let report_userteam = req.session.team;
        const  query = url.parse(req.url, true).query;


        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/report_list.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        
        let sql_str = "";
        sql_str += "SELECT report_userid, report_username, report_userlevel, report_userteam, DATE_FORMAT(report_date,'%Y-%m-%d'), report_text FROM REPORT WHERE report_userlevel < ? and report_userteam = ? ";
        if(query.simple_search_text != "")
        {
            sql_str += "and report_text LIKE '%" + query.simple_search_text + "%' ";
        }
        
        sql_str += "ORDER BY report_date DESC";

        db.query(sql_str, [report_userlevel, report_userteam], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {
                //console.log(results);
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../',
                    List            :results
                }));
            }
        });

    } else {
        res.redirect('/');
    }
};

const DetailSearchReport = (req, res) => {
    if(req.session.userid) {
        let report_userlevel = req.session.level;
        let report_userteam = req.session.team;
        const  query = url.parse(req.url, true).query;

        //console.log(query);

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/report_list.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        
        let sql_str = "";
        sql_str += "SELECT report_userid, report_username, report_userlevel, report_userteam, DATE_FORMAT(report_date,'%Y-%m-%d'), report_text FROM REPORT WHERE report_userlevel < ? and report_userteam = ? ";
        // **query로 파싱한 데이터는 ''가 없기 때문에 '로 문자열을 감싸준 후 mysql 쿼리문에 넣어야 한다.
        if(query.detail_search_startdate != "")
        {
            sql_str += ("and DATE_FORMAT(report_date,'%Y-%m-%d') >= '" + query.detail_search_startdate + "' "); 
        }
        if(query.detail_search_enddate != "")
        {
            sql_str += ("and DATE_FORMAT(report_date,'%Y-%m-%d') <= '" + query.detail_search_enddate + "' "); 
        }    
        if(query.detail_search_text != "")
        {
            sql_str += "and report_text LIKE '%" + query.detail_search_text + "%' ";
        }
        if(query.detail_search_user != "")
        {
            sql_str += "and report_username = '" + query.detail_search_user + "' ";
        }

        sql_str += "ORDER BY report_date DESC";

        db.query(sql_str, [report_userlevel, report_userteam], (error, results) => {
            if(error) {
                console.log(error);
                res.end("error");
            } else {
                //console.log(results);
                res.end(ejs.render(HtmlPageStream , {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'../',
                    List            :results
                }));
            }
        });

    } else {
        res.redirect('/');
    }
};



// router를 메서드에 따라서 호출
router.get('/week',    Write_WeeklyReport_UI);
router.get('/month', Write_MonthlyReport_UI)
router.post('/week', Upload_WeeklyReport);
router.post('/month', Upload_MonthlyReport);

router.get('/list', ReportListUI);
router.get('/list/content', ReportContentUI);

router.get('/simplesearch', SimpleSearchReport);
router.get('/detailsearch', DetailSearchReport);



// 외부모듈로 추출
module.exports = router

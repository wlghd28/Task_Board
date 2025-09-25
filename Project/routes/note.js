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
const   multer      = require('multer');
const { isRegExp } = require('util/types');

// var storage  = multer.diskStorage({ // 2
//     destination(req, file, cb) {
//       cb(null, 'public/images/');
//     },
//     filename(req, file, cb) {
//       cb(null, `${file.originalname}`);
//     },
//   });
// const   uploadimage      = multer({storage:  storage}); //업로드 경로 설정

const   uploadimage      = multer({dest:  'public/images/'}); //업로드 경로 설정
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
    로그인하면 바로 보이는 화면
*/ 
const AddNoteUI = (req, res) => {
    if (req.session.userid) {  
        let date = new Date();
        let str_date = date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + (date.getDate())).slice(-2);

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/note_add_form.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        let sql_str = "SELECT * FROM NOTE WHERE note_userid = ? and DATE_FORMAT(note_date,'%Y-%m-%d') = ?";

        db.query(sql_str, [req.session.userid, str_date], (error, results) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
                //console.log(results[0]);

                res.end(ejs.render(HtmlPageStream, {
                    'title'         :'Task Board',
                    level           :req.session.level,
                    userid          :req.session.userid,
                    src_url         :'',
                    date            :str_date,
                    Note            :results[0]
                }));
                
            }
        });
    } else {
        res.redirect('/');
    }
};

/*
    노트 데이터 추가
*/ 
const AddNote = (req, res) => {
    //console.log("Add Note post 메시지 받음!");
    if (req.session.userid) {  
        let body = req.body;    
        let note_date = new Date(); 
        let str_date = note_date.getFullYear() + "-" + ("0" + (note_date.getMonth() + 1)).slice(-2) + "-" + ("0" + (note_date.getDate())).slice(-2);
        let note_userid = req.session.userid;
        let note_username = req.session.who;
        let imagefiles = req.files;
        let note_imagepath = new Array(10);
        let note_imagetext = new Array(10);
        let arr_imagepath = new Array(10);
        let note_text = body.text;

        //console.log(imagefiles);
        //console.log(body.imagecheck);
        //console.log(body);

        // 먼저 현재 날짜로 저장되어 있는 노트가 있는지 확인
        let sql_str_search = "SELECT * FROM NOTE WHERE note_userid = ? and DATE_FORMAT(note_date,'%Y-%m-%d') = ?";
        db.query(sql_str_search, [note_userid, str_date],  (error, results) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
                // 저장되어 있는 데이터가 있는 경우 수정
                if(results.length > 0)
                {
                    let sql_str_update = "";
                    sql_str_update += "UPDATE NOTE SET ";
                    sql_str_update += "note_date = ?, note_userid = ?, note_username = ?, note_text = ?,";
                    sql_str_update += "note_imagepath1 = ?, note_imagepath2 = ?, note_imagepath3 = ?, note_imagepath4 = ?, note_imagepath5 = ?, note_imagepath6 = ?, note_imagepath7 = ?, note_imagepath8 = ?, note_imagepath9 = ?, note_imagepath10 = ?,";
                    sql_str_update += "note_imagetext1 = ?, note_imagetext2 = ?, note_imagetext3 = ?, note_imagetext4 = ?, note_imagetext5 = ?, note_imagetext6 = ?, note_imagetext7 = ?, note_imagetext8 = ?, note_imagetext9 = ?, note_imagetext10 = ? ";
                    sql_str_update += "WHERE note_userid = ? and DATE_FORMAT(note_date,'%Y-%m-%d') = ?"

                    note_imagepath = [];
                    note_imagetext = [];
                    arr_imagepath = 
                    [
                        results[0].note_imagepath1, 
                        results[0].note_imagepath2,
                        results[0].note_imagepath3,
                        results[0].note_imagepath4,
                        results[0].note_imagepath5,
                        results[0].note_imagepath6,
                        results[0].note_imagepath7,
                        results[0].note_imagepath8,
                        results[0].note_imagepath9,
                        results[0].note_imagepath10
                    ];

                    var fileindex = 0;

                    if(typeof(body.imagecheck) == 'string')    
                    {
                        if(body.imagecheck == 'ok') 
                        {
                            // 기존 경로에 있던 이미지는 삭제
                            if(body.imagepath != null  && body.imagepath != '')
                            {
                                fs.unlink(body.imagepath, (error) => {
                                    if(error) console.log("line_147 : " + error);
                                });
                            }
                            note_imagepath[0] = imagefiles[0].path;
                        }
                        else
                        {
                            note_imagepath[0] = body.imagepath;
                        }

                        note_imagetext[0] = body.imagetext; 
                        
                        for(var i = 1; i < 10; i++)
                        {
                            if(arr_imagepath[i] != null && arr_imagepath[i] != '')
                            {
                                fs.unlink(arr_imagepath[i], (error) => {
                                    if(error) console.log("line_157 : " + error);
                                });
                            }
                        }

                    }
                    else if (typeof(body.imagecheck) == 'object')
                    {           
                        for(var i = 0; i < body.imagecheck.length; i++)
                        {
                            if(body.imagecheck[i] == 'ok')
                            {
                                // 기존 경로에 있던 이미지는 삭제
                                if(body.imagepath[i] != null && body.imagepath[i] != '')
                                {
                                    fs.unlink(body.imagepath[i], (error) => {
                                        if(error) console.log("line_179 : " + error);
                                    });
                                }
                                note_imagepath[i] = imagefiles[fileindex].path;
                                fileindex++;
                            }
                            else
                            {
                                note_imagepath[i] = body.imagepath[i];
                            }
                            note_imagetext[i] = body.imagetext[i]; 
                        }

                        for(var i = body.imagecheck.length; i < 10; i++)
                        {
                            if(arr_imagepath[i] != null && arr_imagepath[i] != '')
                            {
                                fs.unlink(arr_imagepath[i], (error) => {
                                    if(error) console.log("line_197 : " + error);
                                }); 
                            }
                        }
                    }
                

                    db.query(sql_str_update, 
                        [
                            note_date, 
                            note_userid,
                            note_username,
                            note_text,
                            note_imagepath[0],
                            note_imagepath[1],
                            note_imagepath[2],
                            note_imagepath[3],
                            note_imagepath[4],
                            note_imagepath[5],
                            note_imagepath[6],
                            note_imagepath[7],
                            note_imagepath[8],
                            note_imagepath[9],
                            note_imagetext[0],
                            note_imagetext[1],
                            note_imagetext[2],
                            note_imagetext[3],
                            note_imagetext[4],
                            note_imagetext[5],
                            note_imagetext[6],
                            note_imagetext[7],
                            note_imagetext[8],
                            note_imagetext[9],
                            note_userid,
                            str_date
                        ],  
                        (error) => {
                        if (error) {     
                            console.log(error);
                            res.end("error");
                        } else {
                            //console.log("DB수정 성공!!");    
                            res.redirect('/note');    
                        }
                    });
                }  
                // 저장되어 있는 데이터가 없는 경우 삽입
                else
                {
                    let sql_str_insert = "";
                    sql_str_insert += 'INSERT INTO ';
                    sql_str_insert += 'NOTE(note_date, note_userid, note_username, note_text,';
                    sql_str_insert += 'note_imagepath1, note_imagepath2, note_imagepath3, note_imagepath4, note_imagepath5, note_imagepath6, note_imagepath7, note_imagepath8, note_imagepath9, note_imagepath10,';
                    sql_str_insert += 'note_imagetext1, note_imagetext2, note_imagetext3, note_imagetext4, note_imagetext5, note_imagetext6, note_imagetext7, note_imagetext8, note_imagetext9, note_imagetext10) ';
                    sql_str_insert += 'VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            

                    //console.log(body.imagepath);
                    
                    note_imagepath = [];
                    note_imagetext = [];

                    var fileindex = 0;

                    if(typeof(body.imagecheck) == 'string')    
                    {
                        if(body.imagecheck == 'ok') 
                        {
                            note_imagepath[0] = imagefiles[0].path;
                        }
                        else
                        {
                            note_imagepath[0] = body.imagepath;
                        }
                        note_imagetext[0] = body.imagetext; 

                    }
                    else if (typeof(body.imagecheck) == 'object')
                    {           
                        for(var i = 0; i < body.imagecheck.length; i++)
                        {
                            if(body.imagecheck[i] == 'ok')
                            {
                                note_imagepath[i] = imagefiles[fileindex].path;
                                fileindex++;
                            }
                            else
                            {
                                note_imagepath[i] = body.imagepath[i];
                            }
                            note_imagetext[i] = body.imagetext[i]; 
                        }
                    }
                 
                    

                    db.query(sql_str_insert, 
                        [
                            note_date, 
                            note_userid,
                            note_username,
                            note_text,
                            note_imagepath[0],
                            note_imagepath[1],
                            note_imagepath[2],
                            note_imagepath[3],
                            note_imagepath[4],
                            note_imagepath[5],
                            note_imagepath[6],
                            note_imagepath[7],
                            note_imagepath[8],
                            note_imagepath[9],
                            note_imagetext[0],
                            note_imagetext[1],
                            note_imagetext[2],
                            note_imagetext[3],
                            note_imagetext[4],
                            note_imagetext[5],
                            note_imagetext[6],
                            note_imagetext[7],
                            note_imagetext[8],
                            note_imagetext[9]
                        ],  
                        (error, results) => {
                        if (error) {    
                            console.log(error);
                            res.end("error");
                        } else {
                            //console.log("DB삽입 성공!!");                          
                            res.redirect('/note');    
                        }
                    });

                }
            }
        });
    } else {
        res.redirect('/');
    }
};


const ReviseNote = (req, res) => {
    //console.log("Add Note put 메시지 받음!");
    if (req.session.userid) {  
        let body = req.body;    
        let note_userid = req.session.userid;
        let note_username = req.session.who;
        let imagefiles = req.files;
        let note_imagepath = new Array(10);
        let note_imagetext = new Array(10);
        let arr_imagepath = new Array(10);
        let note_text = body.text;

        //console.log(imagefiles);
        //console.log(body.imagecheck);
        //console.log(body);

        // 먼저 넘어온 날짜로 저장되어 있는 노트가 있는지 확인
        let sql_str_search = "SELECT * FROM NOTE WHERE note_userid = ? and DATE_FORMAT(note_date,'%Y-%m-%d') = ?";
        db.query(sql_str_search, [note_userid, body.date],  (error, results) => {
            if (error) {     
                console.log(error);
                res.end("error");
            } else {
                // 저장되어 있는 데이터가 있는 경우 수정
                if(results.length > 0)
                {
                    let sql_str_update = "";
                    sql_str_update += "UPDATE NOTE SET ";
                    sql_str_update += "note_text = ?,";
                    sql_str_update += "note_imagepath1 = ?, note_imagepath2 = ?, note_imagepath3 = ?, note_imagepath4 = ?, note_imagepath5 = ?, note_imagepath6 = ?, note_imagepath7 = ?, note_imagepath8 = ?, note_imagepath9 = ?, note_imagepath10 = ?,";
                    sql_str_update += "note_imagetext1 = ?, note_imagetext2 = ?, note_imagetext3 = ?, note_imagetext4 = ?, note_imagetext5 = ?, note_imagetext6 = ?, note_imagetext7 = ?, note_imagetext8 = ?, note_imagetext9 = ?, note_imagetext10 = ? ";
                    sql_str_update += "WHERE note_userid = ? and DATE_FORMAT(note_date,'%Y-%m-%d') = ?"

                    note_imagepath = [];
                    note_imagetext = [];
                    arr_imagepath = 
                    [
                        results[0].note_imagepath1, 
                        results[0].note_imagepath2,
                        results[0].note_imagepath3,
                        results[0].note_imagepath4,
                        results[0].note_imagepath5,
                        results[0].note_imagepath6,
                        results[0].note_imagepath7,
                        results[0].note_imagepath8,
                        results[0].note_imagepath9,
                        results[0].note_imagepath10
                    ];

                    var fileindex = 0;

                    if(typeof(body.imagecheck) == 'string')    
                    {
                        if(body.imagecheck == 'ok') 
                        {
                            // 기존 경로에 있던 이미지는 삭제
                            if(body.imagepath != null  && body.imagepath != '')
                            {
                                fs.unlink(body.imagepath, (error) => {
                                    if(error) console.log("line_147 : " + error);
                                });
                            }
                            note_imagepath[0] = imagefiles[0].path;
                        }
                        else
                        {
                            note_imagepath[0] = body.imagepath;
                        }

                        note_imagetext[0] = body.imagetext; 
                        
                        for(var i = 1; i < 10; i++)
                        {
                            if(arr_imagepath[i] != null && arr_imagepath[i] != '')
                            {
                                fs.unlink(arr_imagepath[i], (error) => {
                                    if(error) console.log("line_157 : " + error);
                                });
                            }
                        }

                    }
                    else if (typeof(body.imagecheck) == 'object')
                    {           
                        for(var i = 0; i < body.imagecheck.length; i++)
                        {
                            if(body.imagecheck[i] == 'ok')
                            {
                                // 기존 경로에 있던 이미지는 삭제
                                if(body.imagepath[i] != null && body.imagepath[i] != '')
                                {
                                    fs.unlink(body.imagepath[i], (error) => {
                                        if(error) console.log("line_179 : " + error);
                                    });
                                }
                                note_imagepath[i] = imagefiles[fileindex].path;
                                fileindex++;
                            }
                            else
                            {
                                note_imagepath[i] = body.imagepath[i];
                            }
                            note_imagetext[i] = body.imagetext[i]; 
                        }

                        for(var i = body.imagecheck.length; i < 10; i++)
                        {
                            if(arr_imagepath[i] != null && arr_imagepath[i] != '')
                            {
                                fs.unlink(arr_imagepath[i], (error) => {
                                    if(error) console.log("line_197 : " + error);
                                }); 
                            }
                        }
                    }
                

                    db.query(sql_str_update, 
                        [
                            note_text,
                            note_imagepath[0],
                            note_imagepath[1],
                            note_imagepath[2],
                            note_imagepath[3],
                            note_imagepath[4],
                            note_imagepath[5],
                            note_imagepath[6],
                            note_imagepath[7],
                            note_imagepath[8],
                            note_imagepath[9],
                            note_imagetext[0],
                            note_imagetext[1],
                            note_imagetext[2],
                            note_imagetext[3],
                            note_imagetext[4],
                            note_imagetext[5],
                            note_imagetext[6],
                            note_imagetext[7],
                            note_imagetext[8],
                            note_imagetext[9],
                            note_userid,
                            body.date
                        ],  
                        (error) => {
                        if (error) {     
                            console.log(error);
                            res.end("error");
                        } else {
                            //console.log("DB수정 성공!!"); 
                            res.redirect('/note/list');    
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
    노트 리스트 UI
*/
const NoteListUI = (req, res) => {
    if (req.session.userid) {  
        // // 3개월 전 날짜를 구한다.
        // let date = new Date();
        // let before_date = new Date();   
        // before_date.setDate(date.getDate() - 92);
        // let str_date = before_date.getFullYear() + "-" + ("0" + (before_date.getMonth() + 1)).slice(-2) + "-" + ("0" + (before_date.getDate())).slice(-2);

        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');     
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/note_list.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

        let sql_str = "";
        sql_str += "SELECT ";
        sql_str += "DATE_FORMAT(note_date,'%Y-%m-%d'), ";
        sql_str += "note_imagetext1, note_imagetext2, note_imagetext3, note_imagetext4, note_imagetext5, note_imagetext6, note_imagetext7, note_imagetext8, note_imagetext9, note_imagetext10,";
        sql_str += "note_text ";
        sql_str += "FROM NOTE WHERE note_userid = ? ORDER BY note_date DESC Limit 100";

        db.query(sql_str, [req.session.userid], (error, results) => {
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
    노트 내용 UI
*/
const NoteContentUI = (req, res) => {
    if(req.session.userid) {
        let user_id = req.session.userid;
        const  query = url.parse(req.url, true).query;

        let today = new Date();
        let note_date = new Date(query.date);
        let diffdate = Math.abs((today - note_date) / (1000 * 3600 * 24));
        let margindate_of_revise = 3;       // 오늘로부터 몇일 전 노트까지 수정할 수 있는지 결정 

        //console.log(diffdate);

        let sql_str = "SELECT * FROM NOTE WHERE note_userid = ? and DATE_FORMAT(note_date,'%Y-%m-%d') = ?";

        if(diffdate > margindate_of_revise)
        {
            let HtmlPageStream = '';
    
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/note_content.ejs','utf8'); 
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
            res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

            db.query(sql_str, [user_id, query.date], (error, results) => {
                if(error) {
                    console.log(error);
                    res.end("error");
                } else {
                    //날짜 색깔변경 테스트
                    //console.log(results);
                    res.end(ejs.render(HtmlPageStream , {
                        'title'         :'Task Board',
                        level           :req.session.level,
                        userid          :req.session.userid,
                        src_url         :'../../',
                        date            :query.date,
                        Content         :results[0]
                    }));
                }
            });
        }
        else
        {
            let HtmlPageStream = '';
    
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/note_revise_form.ejs','utf8'); 
            HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
            res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});

            db.query(sql_str, [user_id, query.date], (error, results) => {
                if(error) {
                    console.log(error);
                    res.end("error");
                } else {
                    //날짜 색깔변경 테스트
                    //console.log(results);
                    res.end(ejs.render(HtmlPageStream , {
                        'title'         :'Task Board',
                        level           :req.session.level,
                        userid          :req.session.userid,
                        src_url         :'../../',
                        date            :query.date,
                        Note            :results[0]
                    }));
                }
            });
        }

    } else {
        res.redirect('/');
    }
};



/*
    노트 검색
*/
const SimpleSearchNote = (req, res) => {
    if(req.session.userid) {
        const  query = url.parse(req.url, true).query;
        let user_id = req.session.userid;
        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/note_list.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        
        let sql_str = "";
        sql_str += "SELECT ";
        sql_str += "DATE_FORMAT(note_date,'%Y-%m-%d'), ";
        sql_str += "note_imagepath1, note_imagepath2, note_imagepath3, note_imagepath4, note_imagepath5, note_imagepath6, note_imagepath7, note_imagepath8, note_imagepath9, note_imagepath10, ";
        sql_str += "note_imagetext1, note_imagetext2, note_imagetext3, note_imagetext4, note_imagetext5, note_imagetext6, note_imagetext7, note_imagetext8, note_imagetext9, note_imagetext10, ";
        sql_str += "note_text ";
        sql_str += "FROM NOTE WHERE note_userid = ? ";
        if(query.simple_search_text != "")
        {
            sql_str += "and (";
            sql_str += "note_imagetext1 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext2 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext3 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext4 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext5 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext6 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext7 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext8 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext9 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_imagetext10 LIKE '%" + query.simple_search_text + "%' or ";
            sql_str += "note_text LIKE '%" + query.simple_search_text + "%'";
            sql_str += ") ";    
        }
        sql_str += "ORDER BY note_date DESC";

        db.query(sql_str, [user_id], (error, results) => {
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

const DetailSearchNote = (req, res) => {
    if(req.session.userid) {
        const  query = url.parse(req.url, true).query;
        let user_id = req.session.userid;
        let HtmlPageStream = '';
    
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/header.ejs','utf8');  
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/navbar.ejs','utf8');   
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/note_list.ejs','utf8'); 
        HtmlPageStream += fs.readFileSync(__dirname + '/../views/footer.ejs','utf8'); 
        res.writeHead(200, {'Content-Type':'text/html; charset=utf8'});
        

        //console.log(query);
        //console.log(typeof(query.detail_search_startdate));

        let sql_str = "";
        sql_str += "SELECT ";
        sql_str += "DATE_FORMAT(note_date,'%Y-%m-%d'), ";
        sql_str += "note_imagepath1, note_imagepath2, note_imagepath3, note_imagepath4, note_imagepath5, note_imagepath6, note_imagepath7, note_imagepath8, note_imagepath9, note_imagepath10, ";
        sql_str += "note_imagetext1, note_imagetext2, note_imagetext3, note_imagetext4, note_imagetext5, note_imagetext6, note_imagetext7, note_imagetext8, note_imagetext9, note_imagetext10, ";
        sql_str += "note_text ";
        sql_str += "FROM NOTE WHERE note_userid = ? ";

        // **query로 파싱한 데이터는 ''가 없기 때문에 '로 문자열을 감싸준 후 mysql 쿼리문에 넣어야 한다.
        if(query.detail_search_startdate != "")
        {
            sql_str += ("and DATE_FORMAT(note_date,'%Y-%m-%d') >= '" + query.detail_search_startdate + "' "); 
        }
        if(query.detail_search_enddate != "")
        {
            sql_str += ("and DATE_FORMAT(note_date,'%Y-%m-%d') <= '" + query.detail_search_enddate + "' "); 
        }
        if(query.detail_search_text != "")
        {
            sql_str += "and ";
            sql_str += "(";
            sql_str += "note_imagetext1 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext2 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext3 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext4 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext5 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext6 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext7 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext8 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext9 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_imagetext10 LIKE '%" + query.detail_search_text + "%' or ";
            sql_str += "note_text LIKE '%" + query.detail_search_text + "%'";
            sql_str += ") ";   
        }
        sql_str += "ORDER BY note_date DESC";

        db.query(sql_str, [user_id], (error, results) => {
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
router.get('/',    AddNoteUI);
router.post('/add',  uploadimage.array('imagefiles'), AddNote);
router.put('/revise', uploadimage.array('imagefiles'), ReviseNote);
router.get('/list', NoteListUI);
router.get('/list/content', NoteContentUI);

router.get('/simplesearch', SimpleSearchNote);
router.get('/detailsearch', DetailSearchNote);


// 외부모듈로 추출
module.exports = router

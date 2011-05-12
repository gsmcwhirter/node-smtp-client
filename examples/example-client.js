/*===============================================
  File:      example-client.js
  
  Author:    Micheil Smith
             Gregory McWhirter
  Description:
    Demonstration of the smtp library.
===============================================*/
var sys = require("util");
var start_mem = process.memoryUsage();

sys.puts(JSON.stringify(start_mem));

//var smtp = require('smtp');
var smtp = require("../index");
var to = "you@example.com";

var client = new smtp({host: "localhost",
        port: 25,
        from_addr: "you@example.com",
        secure: false,
        debug: true,
        auth_required: false,
        user: "",
        pass: ""});

var message = "So, It looks like node-smtp all works, which is great news!\n\
\n\
Your's Truly,\n\
SMTP Client.";

var themail = {
    from: "Node-SMTP",
    to: to,
    body: message,
    subject: "Node SMTP Works!"
};

client.send(themail, function (successful){
    if (successful){
        sys.puts("Mail sent successfully.");
    }
    else {
        sys.puts("Mail failed to be sent.");
    }
    
    var mem = process.memoryUsage();
    sys.puts(JSON.stringify(mem));
    sys.puts(mem["rss"]-start_mem["rss"]);
    sys.puts(mem["vsize"] - start_mem["vsize"]);
    sys.puts(mem["heapTotal"] - start_mem["heapTotal"]);
    sys.puts(mem["heapUsed"] - start_mem["heapUsed"]);
});
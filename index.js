// Copyright 2010 Greg McWhirter
// Please see the LICENSE file for licensing terms.
//

var Client = require('./lib/client'),
    sys = require('util');

var SMTP = module.exports = function (config){
    this._config = {
        host: "localhost",
        port: 25,
        from_addr: "",
        secure: false,
        debug: false,
        auth_required: false,
        user: "",
        pass: ""
    };

    if (config){
        for (var key in config){
            this._config[key] = config[key];
        }
    }
}

SMTP.prototype.send = function (mail, callback){
    var client = new Client();
    var rcpt_list = [];
    var self = this;
    var headers = mail.headers || {};
    var message = '';

    client.addListener("error", function(err, context){
        context = context || "packet";

        if (context == "quit")
        {
            client.disconnect(function (){callback(false, err);});
        }
        else if (context == "disconnect")
        {
            callback(false, err);
        }
        else
        {
            client.quit(function (){
                client.disconnect(function (){callback(false, err);});
            });
        }
    });

    if (this._config.debug)
    {
        client.addListener("packetSent", function (data){
            sys.debug(">>> "+data);
        });
    }

    headers["Date"] = (new Date()).toString();
    headers["From"] = mail.from + " <"+this._config.from_addr+">";

    if (mail.to instanceof Array){
        headers["To"] = mail.to.join(", ");
        mail.to.forEach(function (item){
            rcpt_list.push(item);
        });
    }
    else {
        headers["To"] = mail.to;
        rcpt_list.push(mail.to);
    }

    if (mail.cc){
        if (mail.cc instanceof Array){
            headers["Cc"] = mail.cc.join(", ");
            mail.cc.forEach(function (item){
                rcpt_list.push(item);
            });
        }
        else
        {
            headers["Cc"] = mail.cc;
            rcpt_list.push(mail.cc);
        }
    }

    if (mail.bcc){
        if (mail.bcc instanceof Array)
        {
            headers["Bcc"] = mail.bcc.join(", ");
            mail.bcc.forEach(function (item){
                rcpt_list.push(item);
            });
        }
        else
        {
            headers["Bcc"] = mail.bcc;
            rcpt_list.push(mail.bcc);
        }

    }

    headers["Subject"] = mail.subject;

    Object.keys(headers).forEach(function (key){
        message += key+": "+headers[key]+"\r\n";
    });
    message += "\r\n"+mail.body;

    client.connect(this._config.port, this._config.host, this._config.secure, function (){
        var send = function (){
            client.mail(self._config.from_addr, function (){
                client.rcptList(rcpt_list.reverse(), function(){
                    client.data(message, function (){
                        client.quit(function (){
                            client.disconnect();
                            callback(true);
                        });
                    });
                });
            });
        };

        if (self._config.auth_required){
            client.auth(self._config.user, self._config.pass, send);
        }
        else {
            send();
        }
    });
}
/*===============================================
  File: client.js
  Author: Micheil Smith
          Greg McWhirter
  
  Description:
    This files implements the raw protocol 
    that is SMTP. The version of SMTP used 
    is as defined in RFC2821.
    
    Implements:
      - SMTP: RFC821
      - ESMTP: RFC2821
      - SMTP Authentication: RFC4954
      - SMTP 8Bit-Mime: RFC1652
      - SMTP over SSL/TLS: RFC2487
===============================================*/

// Global
var sys = require("util");
var tcp = require("net");
var events = require("events");

// Local
var SMTPError = require("./errors");
var PacketHandler = require("./packetHandler");


/*-----------------------------------------------
    SMTP Client
-----------------------------------------------*/
var Client = function(){
  var client = this;
  
  this.socket = null;
  this.packetHandler = new PacketHandler();
  
  this.esmtp = false;
  this.capabilities = {};
  
  this.debug = true;
  
  this.packetHandler.addListener("packet", function(packet){
    if(client.debug){
      sys.debug("\033[0;33m>> "+packet.status+" "+packet.data.join(" ")+"\033[0m");
    }
  })
};

sys.inherits(Client, events.EventEmitter);

Client.prototype.connect = function(port, host, secure, callback){
    if (typeof(callback) != "function") callback = function (){};
    
    if(this.socket == null){
        var client = this;
    
        this.port = port;
        this.host = host;
    
        this.socket = new tcp.createConnection(this.port, this.host);
        if (secure){
            this.socket.setSecure();
        }
        
        this.packetHandler.addListener("packet", function(packet){
            client.packetHandler.removeListener("packet", arguments.callee); 
            if(packet.status == "220"){
                if(/ESMTP/i.test(packet.data)){
                    client.esmtp = true;
                }
                client.handshake(function (){ callback(packet); });
            } else {
                client.emit('error', packet);
            }
        });
        
        this.socket.addListener("connect", function(){
            client.socket.setEncoding("ascii");
            client.socket.addListener("data", function(data){
                client.packetHandler.receive(data);
            });
            
            client.socket.write("");
        });
        
    } else {
        this.emit('cancel','Already Connected');
    }
};

Client.prototype.disconnect = function(callback){
    if (typeof(callback) != "function") callback = function (){};
    
    if(this.socket !== null){
        var client = this;
        try {
            this.socket.end();
            callback();
        } catch (e){
            client.emit('error', e, "disconnect");
        }
    } else {
        this.emit('cancel','Not Connected');
    }
};

// New Evented Send:
Client.prototype.send = function(){
    var client = this;
    
    this.waiting = true;
    this.packetHandler.addListener("packet", function(){    
        client.packetHandler.removeListener("packet", arguments.callee);
        
        callback.apply(this, arguments);
        client.waiting = false;
    });
    
    var callback = Array.prototype.pop.call(arguments);
    var data = Array.prototype.join.call(arguments, " ");
    
    this.socket.write(data+"\r\n");
    this.emit("packetSent", data);
}

/*-----------------------------------------------
    Handshaking
-----------------------------------------------*/
Client.prototype.handshake = function(callback){
    if (typeof(callback) != "function") callback = function (){};
    
    if(this.esmtp){
        this.ehlo(callback);
    } else {
        this.helo(callback);
    }
};

Client.prototype.parseCapabilities = function(data){
  for(var i=1, j=data.length, item; i<j; ++i){
    item = data[i].split(" ");
    this.capabilities[item[0]] = item.length > 1 ? item.join(" ") : true;
  }
};

Client.prototype.helo = function(callback){
    if (typeof(callback) != "function") callback = function (){};
    var client = this;
    
    this.send("HELO", this.host, function (packet){
        if(packet.status == "250"){
            client.parseCapabilities(packet.data);
            client.connected = true;
        
            callback(packet);
        } else {
            client.emit('error', packet);
        }
    });
};

Client.prototype.ehlo = function(callback){
    if (typeof(callback) != "function") callback = function (){};
    var client = this;
    
    this.send("EHLO", this.host, function (packet){
        if(packet.status == "250"){
            client.parseCapabilities(packet.data);
            client.connected = true;
        
            callback(packet);
        } else {
            sys.debug('error here: '+sys.inspect(packet));
            client.emit('error', packet);
        }
    });
};

/*-----------------------------------------------
    Authentication
-----------------------------------------------*/
Client.prototype.auth = function(username, password, callback){
    username = username || "";
    password = password || "";
    if (typeof(callback) != "function") callback = function (){};
    var client = this;
    
    this.send("AUTH", "LOGIN", function (packet){
        if (packet.status == "334")
        {
            var user = new Buffer(username, 'utf8');
            client.send(user.toString('base64'), function (packet){
                if (packet.status == "334")
                {
                    var pass = new Buffer(password, 'utf8');
                    client.send(pass.toString('base64'), function (packet){
                        if (packet.status == "235")
                        {
                            callback(packet);
                        }
                        else
                        {
                            client.emit('error', packet);
                        }
                    });
                }
                else
                {
                    client.emit('error', packet);
                }
            });
        }
        else
        {
            client.emit('error', packet);
        }
    });
};

Client.prototype.auth_methods = {
  plain: function(){},
  login: function(){},
  cram_md5: function(){}
};

/*-----------------------------------------------
    Sending mail
-----------------------------------------------*/
Client.prototype.mail = function(address, callback){
    if (typeof(callback) != "function") callback = function (){};
    var client  = this;
    
    address = "<"+address+">";
        
    this.send("MAIL", "FROM:", address, function (packet){
        if(packet.status == "250"){
            callback(packet);
        } else {
            client.emit('error', packet);
        }
    });
};

Client.prototype.rcpt = function(address, callback){
    if (typeof(callback) != "function") callback = function (){};
    var client  = this;
    
    address = "<"+address+">";
    
    this.send("RCPT","TO:", address, function(packet){
        if(packet.status == "250"){
            callback(packet);
        } else {
            client.emit('error', packet);
        }
    });
  
};

Client.prototype.rcptList = function (address_list, callback){
    var client = this;
    
    function nextAddress(packet){
        if (packet && packet.status != "250")
        {
            client.emit('error', packet);
        }
        else
        {
            //var address = address_list.shift();
            var address = address_list.pop();
            
            if (address)
            {
                client.rcpt(address, nextAddress);
            }
            else
            {
                callback(packet);
            }
        }
    }
    
    nextAddress();
}

Client.prototype.data = function(data, callback){
    if (typeof(callback) != "function") callback = function (){};
    var client = this;
    
    this.send("DATA", function(packet){
      if(packet.status == "354"){
        client.send(data+"\r\n.", function(packet){
          if(packet.status == "250"){
            callback(packet);
          } else {
            client.emit('error', packet);
          }
        });
      }
    });
};

/*-----------------------------------------------
    Other Commands
-----------------------------------------------*/
Client.prototype.rset = function(){};
Client.prototype.vrfy = function(){};
Client.prototype.expn = function(){};
Client.prototype.help = function(){};
Client.prototype.noop = function(callback){
    if (typeof(callback) != "function") callback = function (){};
    
    this.send("NOOP", function(packet){
        if(packet.status == "250"){
            callback(packet);
        } else {
            client.emit('error', packet);
        }
    });
};

/*-----------------------------------------------
    Quit Command
-----------------------------------------------*/
Client.prototype.quit = function(callback){
    if (typeof(callback) != "function") callback = function (){};
    var client = this;

    this.send("QUIT", function(packet){
        if(packet.status == "221"){
            callback(packet);
        } else {
            client.emit('error', packet, "quit");
        }
    });
};

module.exports = exports = Client;

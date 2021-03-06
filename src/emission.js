'use strict';

var emit = require("./emit");
var on = require("./on");

var listeners = {};
var setTimeOutHandle;

function emission(event, channelPromise){
    var dependencies = [];
    var timeout = 60000;
    var timeoutHandler;

    var emission = {
        event: event,
        on: function(eventName, callback){
            dependencies.push(
                registerCallback(eventName, callback)
            );
            return emission;
        },
        timeOut: function(a, b){
            if(typeof a == "function") timeoutHandler = a;
            if(typeof a == "number") timeout = a;
            if(typeof b == "function") timeoutHandler = b;
            if(typeof b == "number") timeout = b;

            return emission;
        },
        timeout: function (a, b) {
            return emission.timeOut(a, b);
        },
        execute: function(){
            var emitted = Promise.all(dependencies).then(function(){
                return emit(event, channelPromise);
            });

            emitted.then(function () {
                setTimeOutHandle = setTimeout(function () {
                    done();
                    if(timeoutHandler) timeoutHandler();
                }, timeout)
            });

            return emitted;
        }
    };

    return emission;



    function done(){
        if(setTimeOutHandle) {
            clearTimeout(setTimeOutHandle);
        }
        clearCallbacks(event)
    }

    function registerCallback(eventName, callback){
        var listener = getOrCreateListener(eventName, callback);
        return listener.promise;
    }

    function getOrCreateListener(eventName, callback){
        var uid = event.correlationId + "." + eventName;
        var listener = listeners[eventName];

        if(!listener){
            listener = createListener(eventName, callback);
            listeners[eventName] = listener;
        } else {
            listener.callbacks[uid] = callback;
        }

        return listener;
    }

    function clearCallbacks(event){
        Object.keys(listeners).forEach((key) => {
            let listener = listeners[key];
            Object.keys(listener.callbacks).forEach((name) => {
                if(name.match(event.correlationId + ".*")) {
                    delete listener.callbacks[name];
                };
            });
        })
    }

    function createListener(eventName, callback){
        var routingKey = event.correlationBlock + "." + eventName;
        var uid = event.correlationId + "." + eventName;

        var callbacks = {};
        callbacks[uid] = callback;

        var promise = on(event.service, channelPromise, routingKey, function(ev){
            var eventUid = ev.correlationId + "." + eventName;
            Object.keys(callbacks).forEach((uid) => {
                if(eventUid == uid) callbacks[uid](ev);
            });
        });

        return {
            promise: promise,
            callbacks: callbacks
        };
    }
}
module.exports = emission;
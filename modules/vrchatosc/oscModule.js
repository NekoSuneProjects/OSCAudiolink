// oscModule.js
const dgram = require('dgram');
const oscClient = dgram.createSocket('udp4');
let oscPort = 9000;

function sendOsc(parameters, levels) {
    parameters.forEach((param, index) => {
        const value = levels[index];
        const buffer = createOscMessage(param, value);
        oscClient.send(buffer, oscPort, '127.0.0.1', (error) => {
            if (error) console.error('OSC Error:', error);
        });
    });
}

function createOscMessage(address, value) {
    const encoder = new TextEncoder();
    const addressBuffer = encoder.encode(address + '\0');
    const typeTag = encoder.encode(',f\0\0');
    const floatBuffer = Buffer.alloc(4);
    floatBuffer.writeFloatBE(value, 0);
    return Buffer.concat([addressBuffer, typeTag, floatBuffer]);
}

function sendToChatbox(message) {
    const encoder = new TextEncoder();
    const chatboxAddress = "/chatbox/input";
    const addressBuffer = encoder.encode(chatboxAddress + '\0');
    const typeTag = encoder.encode(',s\0');
    const messageBuffer = encoder.encode(message + '\0');
    const buffer = Buffer.concat([addressBuffer, typeTag, messageBuffer]);

    oscClient.send(buffer, oscPort, '127.0.0.1', (error) => {
        if (error) console.error("OSC Chatbox Error:", error);
    });
}


module.exports = {
    sendOsc,
    sendToChatbox
};

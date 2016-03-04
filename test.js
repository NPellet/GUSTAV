

var SerialPort = require("serialport").SerialPort;

var serialPort = new SerialPort("/dev/tty.usbmodem1411", {
  baudrate: 9600,
  dataBits: 8, 
  flowControl: true,
  stopBits: 1,
});

serialPort.on("open", function() {
	console.log('opened');
	setTimeout( function() {
		
		serialPort.write( "5,0,0;" );		
		
		serialPort.drain();
	}, 1000 );
});

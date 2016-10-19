
#include <DeviceBoard4.1.h>
#include <SPI.h>

String inputString = "";         // a string to hold incoming data
boolean stringComplete = false;  // whether the string is complete

DeviceBoard board = DeviceBoard();

void setup() {  
   
   SPI.begin();
   
   Serial.begin(57600); // Initializes Serial communication (for debugging)
   board.init();
   inputString.reserve(100);  
 
};

int cmdToChan( String cmd ) {
  int pos = cmd.indexOf(":ch");
  if( pos > -1 ) {  
    return cmd.charAt( pos + 3 ) - '0';
  }
}

String cmdToVar( String cmd ) {

  int pos = 0, pos2;
  String s;
  
  s.reserve( 30 );
  
  while( pos < cmd.length() ) {
    
     pos2 = cmd.indexOf(':', pos );
     if( pos2 < 0 ) {
        pos2 = cmd.length();
      }
      
     if( ! cmd.substring( pos, pos + 2 ).equals("ch") ) {
       s.concat( cmd.substring( pos, (int) min( pos2, pos + 4 ) ) );
     }
     
     pos = pos2 + 1;
  }
  

  return s;
}



void processIncomingCommand( String cmd ) {

  byte len = cmd.length();
  byte pos;
  byte query = 0;

  String v;

  byte chan;

  String cmdcopy = cmd.substring( 0 );
  cmd.toLowerCase();
  chan = cmdToChan( cmd );
 
  if( cmd.charAt( len - 1 ) == '?' ) {
    query = 1;
  }
  
  pos = cmd.indexOf(' ');
  if( pos > -1 ) {
    v = cmd.substring( pos ); 
  }
  
  cmd = cmdToVar( cmd );

 if( cmd.equals( "*idn" ) ) {
      reply( cmdcopy, "GUSTAV4", 0 );
      
 } else if( cmd.equals( F("meastracsend") ) ) {
      if( query ) {
        reply( cmdcopy, board.trackSendRate[ chan ], query );
      } else {
        board.trackSendRate[ chan ] = v.toInt();
      }
 }
else if( cmd.equals( F("calivoltadco") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.adc_offset_v[ chan ], query );
      } else {
        board.adc_offset_v[ chan ] = v.toFloat();
      }

 }else if( cmd.equals( F("calivoltadcs") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.adc_slope_v[ chan ], query );
      } else {
        board.adc_slope_v[ chan ] = v.toFloat();
      }

 } else if( cmd.equals( F("calicurradco") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.adc_offset_i[ chan ], query );
      } else {
        board.adc_offset_i[ chan ] = v.toFloat();
      }

 }else if( cmd.equals( F("calicurradcs") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.adc_slope_i[ chan ], query );
      } else {
        board.adc_slope_i[ chan ] = v.toFloat();
      }

 }else if( cmd.equals( F("measreguposi") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.regulationPos[ chan ], query );
      } else {
        board.regulationPos[ chan ] = v.toFloat();
      }

 }else if( cmd.equals( F("measregunega") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.regulationNeg[ chan ], query );
      } else {
        board.regulationNeg[ chan ] = v.toFloat();
      }

 }/*else if( cmd.equals( "calidacs" ) ) {
      if( query ) {
        reply( cmdcopy, board.dac_slope[ chan ], query );
      } else {
        board.dac_slope[ chan ] = v.toFloat();
      }

 } */else if( cmd.equals( F("measmode") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.mode[ chan ], query );
      } else {
        board.mode[ chan ] = v.toInt();
      }

 } else if( cmd.equals( F("measincr") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.incrementVoltage[ chan ], query );
      } else {
        board.incrementVoltage[ chan ] = v.toInt();
      }
      
  }else if( cmd.equals( F("meastargvolt") ) ) {
  
      if( query ) {
        reply( cmdcopy, board.targetVoltageCode[ chan ], query );
      } else {
        board.targetVoltageCode[ chan ] = v.toInt();
      }
      
  } else if( cmd.equals( F("meastracrate") ) ) {

    if( query ) {
        reply( cmdcopy, board.trackRate[ chan ], query );
      } else {
        board.trackRate[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("measivstar") ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_startvoltage[ chan ], query );
      } else {
        board.iv_startvoltage[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("measivstop") ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_endvoltage[ chan ], query );
      } else {
        board.iv_endvoltage[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("measivscan") ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_scanrate[ chan ], query );
      } else {
        board.iv_scanrate[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("measivnbpo") ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_nbpoints[ chan ], query );
      } else {
        board.iv_nbpoints[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("measivdela") ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_delay[ chan ], query );
      } else {
        board.iv_delay[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("noisvolt") ) ) {
      if( query ) {
        reply( cmdcopy, board.noise_voltage[ chan ], query );
      } else {
        board.noise_voltage[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("noiscurr") ) ) {
      if( query ) {
        reply( cmdcopy, board.noise_current[ chan ], query );
      } else {
        board.noise_current[ chan ] = v.toInt();
      }
 } else if( cmd.equals( F("measimmeiv") ) ) {
  
    board.makeIV( chan );
 
 } else if( cmd.equals( F("measimmevolt") ) ) {
  
    reply( cmdcopy, board.readVoltage( chan ), query );
    
 } else if( cmd.equals( F("measimmecurr") ) ) {
    
    reply( cmdcopy, board.readCurrent( chan ), query );
 } else if( cmd.equals( F("sourvolt") ) ) {

    board.setVoltage( chan, v.toInt() );
 } else {
  
 }
 
}

void reply( String command, unsigned int value, byte query ) {

  if( command.length() > 0 ) { 
    if( query ) {
      command = command.substring( 0, command.length() - 1 );
    }
  
    command.concat(' ');
  }
  command.concat( value );
  command.concat(";");
  Serial.println( command );
}


void reply( String command, String value, byte query ) {

  if( command.length() > 0 ) { 
    if( query ) {
      command = command.substring( 0, command.length() - 1 );
    }
  
    command.concat(' ');
  }
  command.concat( value );
  command.concat(";");
  Serial.println( command );
}


byte currentChan = 0;

void serialEvent() {
  while (Serial.available()) {
    // get the new byte:
    char inChar = (char)Serial.read();
    // add it to the inputString:
    
    // if the incoming character is a newline, set a flag
    // so the main loop can do something about it:
    if (inChar == ';') {
      stringComplete = true;
    } else {
      inputString += inChar;
    }
  }
}


void loop() { 

    board.check( currentChan );
    currentChan++;
    
    if( currentChan == 8 ) {
      currentChan = 0;
    }

    if (stringComplete) {

      stringComplete = false;
      processIncomingCommand( inputString );
      // clear the string:
      inputString = "";
  }

  
}



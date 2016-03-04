//#include <MemoryFree.h>

#include <DeviceBoard.h>

#include <SPI.h>



/*
#include <SolarBoard.h>

*/


#define MAXSTREAMBUFFERSIZE 64

#define pinDACLDAC 31
#define pinDACCLR 33

#define pinMuxA 49
#define pinMuxB 45
#define pinMuxC 47
#define pinMuxD 43
#define pinDLatchA 35
#define pinDLatchB 37
#define pinDLatchC 39
#define pinDLatchD 41
#define pinMuxEn 24
#define pinDLatchEn 26
#define pinDLatchOEn 22
#define pinMISO 74
#define readChannel 0
#define idn "GUSTAV,STAM4000,100002,100002"

DeviceBoard board = DeviceBoard();

void setup() {
   
   SPI.begin();
   Serial.begin(9600); // Initializes Serial communication (for debugging)
    //SerialUSB.begin(115200);

  // put your setup code here, to run once:

    board.assignPinMux( pinMuxEn, pinMuxA, pinMuxB, pinMuxC, pinMuxD);
    board.assignPinDLatch( pinDLatchEn, pinDLatchOEn, pinDLatchA, pinDLatchB, pinDLatchC, pinDLatchD );
    board.assignPinDAC( pinDACLDAC, pinDACCLR );
    
    board.enableChannel( 0 );
    board.enableChannel( 2 );
    board.enableChannel( 4 );
    board.enableChannel( 6 );

    board.init();
 
  //currentBoard = &(boards[ lastBoard ]);
  //currentDevice = &((boards[ lastBoard ]).devices[ 0 ]);
  

  // Listen on serial connection for messages from the pc

  pinMode( 52, INPUT );
  pinMode( 42, INPUT );


};


char serialbuffer[ MAXSTREAMBUFFERSIZE ];       
const char *terminator = ";";
const char *querySign = "?";
int commandlength = 0;


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

  int len = cmd.length();
  String cmdcopy = cmd.substring( 0 );
  cmd.toLowerCase();
  int pos;
  byte query = 0;

  String v;
  int chan = cmdToChan( cmd );
  
  cmd.toLowerCase();
  
  if( cmd.charAt( len - 1 ) == '?' ) {
    query = 1;
  }
  
  pos = cmd.indexOf(" ");
  if( pos > -1 ) {
    v = cmd.substring( pos ); 
  }
  
  String command = cmdToVar( cmd );
  
 if( command.equals( "*idn" ) ) {
      reply("", idn, 0 );
 } else if( command.equals( "meastracsend" ) ) {
      if( query ) {
        reply( cmdcopy, board.trackSendRate[ chan ], query );
      } else {
        board.trackSendRate[ chan ] = v.toInt();
      }
 }
else if( command.equals( "caliadco" ) ) {
      if( query ) {
        reply( cmdcopy, board.adc_offset[ chan ], query );
      } else {
        board.adc_offset[ chan ] = v.toFloat();
      }

 }else if( command.equals( "caliadcs" ) ) {
      if( query ) {
        reply( cmdcopy, board.adc_slope[ chan ], query );
      } else {
        board.adc_slope[ chan ] = v.toFloat();
      }

 }else if( command.equals( "calidaco" ) ) {
      if( query ) {
        reply( cmdcopy, board.dac_offset[ chan ], query );
      } else {
        board.dac_offset[ chan ] = v.toFloat();
      }

 }else if( command.equals( "calidacs" ) ) {
      if( query ) {
        reply( cmdcopy, board.dac_slope[ chan ], query );
      } else {
        board.dac_slope[ chan ] = v.toFloat();
      }

 } else if( command.equals( "measmode" ) ) {
  
      if( query ) {
        reply( cmdcopy, board.mode[ chan ], query );
      } else {
        board.mode[ chan ] = v.toInt();
      }
      
  } else if( command.equals("meastracrate" ) ) {

    if( query ) {
        reply( cmdcopy, board.trackRate[ chan ], query );
      } else {
        board.trackRate[ chan ] = v.toInt();
      }
 } else if( command.equals("measivstar" ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_startvoltage[ chan ], query );
      } else {
        board.iv_endvoltage[ chan ] = v.toInt();
      }
 } else if( command.equals("measivstop" ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_endvoltage[ chan ], query );
      } else {
        board.iv_scanrate[ chan ] = v.toInt();
      }
 } else if( command.equals("measivscan" ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_scanrate[ chan ], query );
      } else {
        board.iv_scanrate[ chan ] = v.toInt();
      }
 } else if( command.equals("measivnbpo" ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_nbpoints[ chan ], query );
      } else {
        board.iv_nbpoints[ chan ] = v.toInt();
      }
 } else if( command.equals("measivdela" ) ) {
      if( query ) {
        reply( cmdcopy, board.iv_delay[ chan ], query );
      } else {
        board.iv_delay[ chan ] = v.toInt();
      }
 } else if( command.equals("measimmeiv") ) {
  
    board.makeIV( chan );
 
 } else if( command.equals("measimmevolt") ) {
  
    reply( cmdcopy, board.readVoltage( chan ), query );
    
 } else if( command.equals("measimmecurr") ) {
  
    reply( cmdcopy, board.readCurrent( chan ), query );
 } else if( command.equals("sourvolt") ) {

    board.setVoltage( chan, v.toInt() );
 }

     
}

void reply( String command, int value, byte query ) {

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

void checkSerial() {
  char incoming;

  while ( Serial.available() ) {    
    delay( 1 );

    incoming = Serial.read();

    serialbuffer[ commandlength ] = incoming;
    commandlength += 1; 
    
    //Serial.write( serialbuffer, len );    
    if( incoming == *terminator ) {
      //Serial.write( serialbuffer, len );    
      serialbuffer[ commandlength - 1] = '\0';
      processIncomingCommand( serialbuffer );
      commandlength = 0;
    }
  } 
}


byte currentChan = 0;

void loop() {

    board.loop( currentChan );
    currentChan++;
    if( currentChan == 8 ) {
      currentChan = 0;
    }

    checkSerial();
}



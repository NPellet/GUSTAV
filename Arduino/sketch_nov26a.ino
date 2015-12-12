#include <CmdMessenger.h>
#include <SolarCell.h>

int ADCSDIn = 33;
int ADCSDOut = 37;
int CSADC1 = 39;
int CSADC2 = 41;
int ADCClk = 35;
int DACClk = 44;
int DACSync = 42;
int DACSD = 40;


int readChannel = 0;
int readChannelCalibration = 0;

int lastDevice = 0;

bool MMPT = true;
bool Calibrate = false;
bool IV = false;


SolarCell devices[ 1 ] = { SolarCell( DACSD, DACSync, DACClk, CSADC1, ADCClk, ADCSDIn, ADCSDOut, 2 ) };
SolarCell currentDevice = devices[ 0 ];

bool waiting = false;

char field_separator   = ',';
char command_separator = ';';
CmdMessenger cmdMessenger = CmdMessenger(SerialUSB, field_separator, command_separator);
#define TIME_RTC 300000


enum
{
  kCOMM_ERROR = 000,    // Lets Arduino report serial port comm error back to the PC (only works for some comm errors)
  kACK = 001,           // Arduino acknowledges cmd was received
  kARDUINO_READY = 002, // After opening the comm port, send this cmd 02 from PC to check arduino is ready
  kERR = 003,           // Arduino reports badly formatted cmd, or cmd not recognised
  kANSWER = 004,
  // For the above commands, we just call cmdMessenger.sendCmd() anywhere we want in our Arduino program.
  kSEND_CMDS_END,       // Mustnt delete this line
};

messengerCallbackFunction messengerCallbacks[] =
{
  setVoltage,
  setRate,
  setCalibration,
  makeIV
};

void doSmth() {}

void setRate() {
  int chan = cmdMessenger.readInt16Arg();
  double rate = cmdMessenger.readDoubleArg();
  currentDevice.setRate( rate );
  waiting = false;
  detachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin( ) ) );

}

void setVoltage() {
  int voltageCode = cmdMessenger.readInt16Arg();
  digitalWrite( 13, HIGH );

  currentDevice.setDAC( voltageCode );
  currentDevice.configureCurrent();
  delay( 20 );
  waiting = true;
  attachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin() ), conversionDoneCalibration, FALLING );
  digitalWrite( currentDevice.getADCCSPin(), LOW ); // Bring the CS Pin low 
}

void setCalibration() {
  
  int chan = cmdMessenger.readInt16Arg();
  
  double DACSlope = cmdMessenger.readDoubleArg();
  double DACOffset = cmdMessenger.readDoubleArg();
  double ADCSlope = cmdMessenger.readDoubleArg();
  double ADCOffset = cmdMessenger.readDoubleArg();

  currentDevice.setDACCalibration( DACSlope, DACOffset );
  currentDevice.setADCCalibration( ADCSlope, ADCOffset );
}
void makeIV() {

  double startVoltage = cmdMessenger.readDoubleArg();
  double stopVoltage = cmdMessenger.readDoubleArg();
  int nbPoints = cmdMessenger.readInt16Arg();
  int settlingTime = cmdMessenger.readInt16Arg();
  int equilibrationTime = cmdMessenger.readInt16Arg();
  detachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin( ) ) );

  currentDevice.makeIV( startVoltage, stopVoltage, nbPoints, settlingTime, equilibrationTime );
  waiting = false;
  attachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin() ), conversionDone, FALLING );
  digitalWrite( currentDevice.getADCCSPin(), LOW ); // Bring the CS Pin low
  
}
/*

void setDACCalibrationCmd() {
  
  int chan = cmdMessenger.readInt16Arg();
  double offset = cmdMessenger.readDoubleArg();
  double slope = cmdMessenger.readDoubleArg();
   
  chan -= 1;
  
  EEPROM.writeDouble( chan * 16, offset ); 
  EEPROM.writeDouble( chan * 16 + 8, slope ); 
  
  DACoffsets[ chan ] = offset;
  DACslopes[ chan ] = slope;
}


void setADCCalibrationCmd() {
  
  int chan = cmdMessenger.readInt16Arg();
  double offset = cmdMessenger.readDoubleArg();
  double slope = cmdMessenger.readDoubleArg();
 
  chan -= 1;
  EEPROM.writeDouble( ( chan + 8 ) * 16, offset ); 
  EEPROM.writeDouble( ( chan + 8 ) * 16 + 8, slope ); 
  
  ADCoffsets[ chan ] = offset;
  ADCslopes[ chan ] = slope;
}*/

// Set cmdMessage general methods
void arduino_ready() {
  //Serial.print("Arduino is ready and running");
  cmdMessenger.sendCmd(kACK,"Arduino ready"); // Sends command 001
}

void unknownCmd() {
  //Serial.print("Unknown command");
  cmdMessenger.sendCmd(kERR,"Unknown command"); // Sends command 003
}

// Attached callbacks to command messenger
void attach_callbacks(messengerCallbackFunction* callbacks)
{
  int i = 0;
  int offset = kSEND_CMDS_END;
  while(callbacks[i])
  {
    cmdMessenger.attach(offset+i, callbacks[i]);
    i++;
  }
}



void setup() {
  // put your setup code here, to run once:
  
   // Listen on serial connection for messages from the pc
  Serial.begin(9600); // Initializes Serial communication (for debugging)
  SerialUSB.begin(115200);

  pinMode( 13, OUTPUT );
  currentDevice = devices[ 0 ];
  // cmdMessenger.discard_LF_CR(); // Useful if your terminal appends CR/LF, and you wish to remove them
  cmdMessenger.printLfCr(); // Make output more readable whilst debugging in Arduino Serial Monitor
  
  // Attach default / generic callback methods
  cmdMessenger.attach(kARDUINO_READY, arduino_ready);
  cmdMessenger.attach(unknownCmd);
  // Attach my application's user-defined callback methods
  attach_callbacks(messengerCallbacks);
  arduino_ready();  
}

void conversionDone() {
  readChannel = 1;    
}

void conversionDoneCalibration() {
  readChannelCalibration = 1;    
}

void loop() {

  if( Calibrate ) {
    
    if( readChannelCalibration == 1 ) {
      digitalWrite( 13, LOW );
      detachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin( ) ) );

      currentDevice.measureCurrent();
      
      cmdMessenger.sendCmdStart(kANSWER);
      cmdMessenger.sendCmdArg( currentDevice.getCurrentCode() );
      cmdMessenger.sendCmdEnd();
      readChannelCalibration = 0;
      waiting = false;
    }
  }

  if( MMPT ) {
  
   if( readChannel == 1 )  {
  
      detachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin( ) ) );
      int nextDevice = currentDevice.currentReady();
      
      if( nextDevice == 0 ) {
        readChannel = 0;
        waiting = false;
 
      } else {
        delay( 10 );
        
        readChannel = 0;
        waiting = true;
        attachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin() ), conversionDone, FALLING );
        digitalWrite( currentDevice.getADCCSPin(), LOW ); // Bring the CS Pin low
      }
    }

    if( ! waiting ) {

      if( currentDevice.MPPT() ) {
        
         waiting = true;
         attachInterrupt( digitalPinToInterrupt( currentDevice.getADCSDPin() ), conversionDone, FALLING );
         digitalWrite( currentDevice.getADCCSPin(), LOW ); // Bring the CS Pin low
     }
   }
  }
  
  cmdMessenger.feedinSerialData();
  //  Serial.println( digitalRead( SDOut ) );
}


void printDouble( double val, unsigned int precision){
// prints val with number of decimal places determine by precision
// NOTE: precision is 1 followed by the number of zeros for the desired number of decimial places
// example: printDouble( 3.1415, 100); // prints 3.14 (two decimal places)

   Serial.print (int(val));  //prints the int part
   Serial.print("."); // print the decimal point
   unsigned int frac;
   if(val >= 0)
       frac = (val - int(val)) * precision;
   else
       frac = (int(val)- val ) * precision;
   Serial.println(frac,DEC) ;
} 



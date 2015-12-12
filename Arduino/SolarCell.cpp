
#include "Arduino.h"
#include "SolarCell.h"

SolarCell::SolarCell( int _DACPin, int _DACSync, int _DACClk, int _ADCCS, int _ADCClk, int _ADCSDIn, int _ADCSDOut, int _ADCChannel )
{
   MPPTdirection = true;
    DACPin = _DACPin;
    DACSync =_DACSync;
    DACClk = _DACClk;
    ADCCS = _ADCCS;
    ADCClk = _ADCClk;
    ADCSDIn = _ADCSDIn;
    ADCSDOut = _ADCSDOut;
    ADCChannel = _ADCChannel;
    
    pinMode(  DACPin, OUTPUT );
    pinMode(  DACSync, OUTPUT );
    pinMode(  DACClk, OUTPUT );
    pinMode(  ADCCS, OUTPUT );
    pinMode(  ADCClk, OUTPUT );
    pinMode(  ADCSDIn, OUTPUT );
    pinMode(  ADCSDOut, INPUT );
    pinMode(  ADCChannel, OUTPUT );

    digitalWrite( ADCClk, LOW );
    digitalWrite( DACClk, LOW );
    
    step = 10;
    mode = 1;

    voltage = 0;
    lastTrackMilli = millis();
    lastSentMilli = millis();
    interval = 200;
    currentCode = 0;
    lastCurrentCode = 0;
    _rate = -3;
}

bool SolarCell::MPPT()
{
    if( millis() - lastTrackMilli > interval && _rate > -3 ) {
        
        
        lastTrackMilli = millis();
        this -> configureCurrent();
        return true;
    }
    
    return false;
}

void SolarCell::setInterval( int inter ) {
    interval = inter;
}

void SolarCell::setDACCalibration( double Slope, double Offset ) {
    DACSlope = (double) Slope;
    DACOffset = (double) Offset;

}


void SolarCell::setADCCalibration( double Slope, double Offset ) {
    ADCSlope = (double) Slope;
    ADCOffset = (double) Offset;

}

int SolarCell::getADCSDPin() {
    return ADCSDOut;
}

int SolarCell::getADCCSPin() {
    return ADCCS;
}

int SolarCell::getCurrentCode() {
    return this->currentCode;
}

void SolarCell::configureCurrent() {
    int out1 = 0;
    int out2 = 0;
    int out3 = 0;
    int out4 = 0;
    
    int in1, in2, in3, in4;
    
    out1 |= B10000000; // Single shot
    
    switch( ADCChannel ) {
            
        case 0:
            out1 |= B01000000;
            break;
            
        case 1:
            out1 |= B01010000;
            break;
            
        case 2:
            out1 |= B01100000;
            break;
            
        case 3:
            out1 |= B01110000;
            break;
    }
    
    out1 |= B00000010; // PGA 4.096V
    out1 |= B00000001; // 1 = power down, single shot mode
    
    out2 |= B10100000; // 128 SPS (3 bit)
    out2 |= B00000000; // ADC Mode (1 = Temperature mode)
    out2 |= B00001000; // Enable pull-up
    out2 |= B00000010; // Write config (01 needed to write, otherwise ignored)
    out2 |= B00000001; // Always 1
    
    digitalWrite( ADCCS, 0 );
    in1 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out1 );
    in2 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out2 );
    in3 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out3 );
    in4 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out4 );
    digitalWrite( ADCCS, 1 );
}

void SolarCell::measureCurrent() {
    
    int out1 = 0;
    int out2 = 0;
    int out3 = 0;
    int out4 = 0;
    int in1, in2, in3, in4;
    
    in1 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out1 );
    in2 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out2 );
    in3 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out3 );
    in4 = this->shiftIO( ADCSDOut, ADCSDIn, ADCClk, out4 );
    
    digitalWrite( ADCCS, 1 );
    
    
    currentCode = ( ( in1 << 4 | ( in2 >> 4 ) ) );
    current = this -> getCurrentFromCode( currentCode );
}


int SolarCell::currentReady() {
    
    int status;
    this->measureCurrent();
    

    if( this->mode == 1) {
        
        if( current * voltage >= lastPower || abs( currentCode - lastCurrentCode ) < 3 ) {
            MPPTdirection = MPPTdirection;
        } else {
            MPPTdirection = !MPPTdirection;
            lastCurrentCode = currentCode;
        }

        lastPower = current * voltage;
    
        if( _rate > -2 ) {
     /*   SerialUSB.println( millis() );
        SerialUSB.println( lastSentMilli );
        SerialUSB.println( _rate );
        SerialUSB.print(";");
      */
            if( millis() - lastSentMilli > _rate || _rate == -1 ) {
        
                lastSentMilli = millis();
                SerialUSB.print("5,5,");
                SerialUSB.print( round( current * 1000000 ) );
                SerialUSB.print(",");
                SerialUSB.print( round( voltage * 1000000  ) );
                SerialUSB.print(",");
                SerialUSB.print( round( lastPower * 1000000)  );
                SerialUSB.print(";");
            }
        }
    
        if( ! MPPTdirection ) {
            incrementVoltageCode( step );
        } else {
            incrementVoltageCode( -step );
        }
        
        status = 0;
        
    } else if( this->mode == 2 ){
        
        this->ivvoltages[ this->ivnb ] = this->voltage;
        this->ivcurrents[ this->ivnb ] = this->current;
        this->ivnb++;
        
        
        if( this->ivnb == this->ivnbpoints ) {
            this->mode = 0;
            
            
            SerialUSB.print("6,5");
            
            for (int i = 0; i < this->ivnbpoints; i ++) {
                SerialUSB.print( "," );
                SerialUSB.print( round( this->ivvoltages[ i ] * 1000000 ) );
            }
            for (int i = 0; i < this->ivnbpoints; i ++) {
                SerialUSB.print( "," );
                SerialUSB.print( round( this->ivcurrents[ i ] * 1000000 ) );
            }
            
            SerialUSB.println(";");
            status = 0;
            

        } else {
            
            this->setVoltage( this->voltage + this->ivvoltagestep );
            delay( this->ivsettlingTime );
            this -> configureCurrent();
            status = 1;
            
        }
        

    }
    
    // 1 = busy
    // 0 = done
    return status;
}

void SolarCell::makeIV( double startVoltage, double stopVoltage, int nbPoints, int settlingTime, int equilibrationTime ) {
    
    if( nbPoints > 100 ) {
        nbPoints = 100;
    }
    
    this -> mode = 2;
    this -> ivvoltagestep = ( stopVoltage - startVoltage ) / ( nbPoints - 1 );
    this -> ivnb = 0;
    this -> ivnbpoints = nbPoints;
    this -> ivsettlingTime = settlingTime;
    this -> setVoltage( startVoltage );
    this -> configureCurrent();
    delay( equilibrationTime );

}

void SolarCell::incrementVoltageCode( int byHowMuch ) {

    this->voltageCode += byHowMuch;

    if( voltageCode < 0 ) {
        this->voltageCode = 0;
        this->voltageCode -= 2 * byHowMuch;
        this->MPPTdirection = !this->MPPTdirection;
    }
    
    if( voltageCode > 4095 ) {
        this->MPPTdirection = !this->MPPTdirection;
        this->voltageCode -= 2 * byHowMuch;
        this->voltageCode = 4095;
    }

    this->voltage = this->getVoltageFromCode( this->voltageCode );

    this->setDAC( this->voltageCode );
}

double SolarCell::getVoltageFromCode( int code ) {

    return (double) code * DACSlope + DACOffset;
}

int SolarCell::getCodeFromVoltage( double voltage ) {
    return (int) round( ( voltage - DACOffset ) / DACSlope );
}

double SolarCell::getCurrentFromCode( int code ) {

    return (double) code * ADCSlope + ADCOffset;
}

void SolarCell::setVoltage( double voltage ) {
    
    this -> voltage = voltage;
    this -> voltageCode = this -> getCodeFromVoltage( voltage );
    
    if( this -> voltageCode <  0 ) {
        this->voltageCode = 0;
    }
    
    if( this -> voltageCode >  4095 ) {
        this->voltageCode = 4095;
    }
            
     this -> voltage = this->getVoltageFromCode( this->voltageCode );
    this -> setDAC( this -> voltageCode );
}

void SolarCell::setDAC( int voltageCode ) {
    int val2 = voltageCode;
    int val1 = voltageCode >> 8;
    digitalWrite( DACSync, 0 );
    shiftOut( DACPin, DACClk, MSBFIRST, val1 );
    shiftOut( DACPin, DACClk, MSBFIRST, val2 );
    digitalWrite( DACSync, 1 );
}

int SolarCell::shiftIO( int dataInPin, int dataOutPin, int clockPin, int dataOut ) {
    
    int result = 0;
    int i;
    for ( i = 7; i >= 0; i-- )  {
        
        digitalWrite(dataOutPin, !!( dataOut & (1<<i) ) );  
        digitalWrite(clockPin, 1);
        result = result | ( ( digitalRead( dataInPin ) << i ) );  
        digitalWrite(clockPin, 0);
        digitalWrite(dataOutPin, 0);
    }
    digitalWrite(clockPin, 0);
    
    return result;
}

void SolarCell::printDouble( double val, unsigned int precision){
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


void SolarCell::setRate( long rate ) {
    _rate = rate;
}


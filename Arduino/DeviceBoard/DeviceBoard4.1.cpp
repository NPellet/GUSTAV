
#include "Arduino.h"
#include "DeviceBoard4.1.h"
#include "SPI.h"


#define LDAC 10
#define CLR 9
#define CS_DAC_0 8
#define CS_DAC_1 7
#define CS_DAC_2 6
#define CS_DAC_3 5
#define EN 4
#define CS_ADC 2

#define MUX_S1 A0
#define MUX_S2 A1
#define MUX_S3 A2
#define MUXEN A3

DeviceBoard::DeviceBoard( ) {

}

void DeviceBoard::init() {
    
    digitalWrite( EN, 1 );
    delay( 10 ); // 10ms at least start-up time
    
    configureDAC( 0 );
    configureDAC( 2 );
    configureDAC( 4 );
    configureDAC( 6 );
    
    pinMode( CLR, OUTPUT );
    pinMode( CS_DAC_0, OUTPUT );
    pinMode( CS_DAC_1, OUTPUT );
    pinMode( CS_DAC_2, OUTPUT );
    pinMode( CS_DAC_3, OUTPUT );
    pinMode( CS_ADC, OUTPUT );
    
    pinMode( MUX_S1, OUTPUT );
    pinMode( MUX_S2, OUTPUT );
    pinMode( MUX_S3, OUTPUT );
    pinMode( MUXEN, OUTPUT );
    
    digitalWrite( CLR, HIGH );
    digitalWrite( CS_DAC_0, HIGH );
    digitalWrite( CS_DAC_1, HIGH );
    digitalWrite( CS_DAC_2, HIGH );
    digitalWrite( CS_DAC_3, HIGH );
    digitalWrite( CS_ADC, HIGH );
    
}


void DeviceBoard::check( byte chan ) {

    // MPPT Mode
    switch( mode[ chan ] ) {
            
        case 1:
            trackMPP_PO( chan );
        break;
            
        case 3:
            trackMPP_steadyV( chan );
        break;
    }
}


bool DeviceBoard::isEnabled( byte chan ) {
    return mode[ chan ] > 0;
}


void DeviceBoard::trackMPP_PO( byte chan ) {
    
    if( millis() - trackLastTime[ chan ] < trackRate[ chan ] ) {
        return;
    }
    
    trackLastTime[ chan ] = millis();
    
    muxChannel( chan );
    
    unsigned int current = readCurrent( chan );
    unsigned int voltage = readVoltage( chan );
    
    long dI = (long) ( ( long ) current - ( long ) lastCurrent[ chan ] );
    long dV = (long) ( ( long ) voltage - ( long ) lastVoltage[ chan ] );
    
if( abs( dI ) < noise_current[ chan ] ) {
 current = lastCurrent[ chan ];
}
if( abs( dV ) < noise_voltage[ chan ] ) {
  voltage = lastVoltage[ chan ];
}

double power = getCurrentFromCode( current, chan ) * getVoltageFromCode( voltage, chan );
double difference = power - lastPower[ chan ];

    
double regulation;
    
    if( difference > 0 ) {
        //    Serial.println( difference );
        lastPower[ chan ] = power;

        lastCurrent[ chan ] = current;
        lastVoltage[ chan ] = voltage;
        
    } else if( lastPower[ chan ] == 0 ){
        
        lastPower[ chan ] = power;
        
    } else {

    
        double ratio = (double) (  difference / ( fabs( lastPower[ chan ] ) ) );
     //   Serial.println( ratio * 10000 );
        
        if( dV < 0 ) {
            regulation = regulationNeg[ chan ];
        } else {
            regulation = regulationPos[ chan ];
        }
       
        if( ratio < - regulation ) {
            
            lastPower[ chan ] = power;
            direction[ chan ] = direction[ chan ] * -1;
/*
            if( direction[ chan ] < 0 ) {
                delay( switchTimeDelayBackward[ chan ] );

            } else {
                delay( switchTimeDelayForward[ chan ] );

            }
 */
        }
        
        lastCurrent[ chan ] = current;
        lastVoltage[ chan ] = voltage;
        
    }
 
    
    voltageMean[ chan ] =  ( ( ( unsigned long ) ( voltageMean[ chan ] ) * trackNb[ chan ] ) + voltage ) / ( trackNb[ chan ] + 1 );
    currentMean[ chan ] =  ( ( ( unsigned long ) ( currentMean[ chan ] ) * trackNb[ chan ] ) + current ) / ( trackNb[ chan ] + 1 );
    
    
    voltageMax[ chan ] = max( voltageMax[ chan ], voltage );
    voltageMin[ chan ] = min( voltageMin[ chan ], voltage );
    
    currentMax[ chan ] = max( currentMax[ chan ], current );
    currentMin[ chan ] = min( currentMin[ chan ], current );
    
    trackNb[ chan ] += 1;
    sendMPPT( chan );
    setVoltage( chan, voltageCode[ chan ] + ( direction[ chan ] * incrementVoltage[ chan ] ) );
}

// Used incremental conductance to track maximum power output
void DeviceBoard::trackMPP_incrC( byte chan ) {
  /*
    if( millis() - trackLastTime[ chan ] < trackRate[ chan ] ) {
        return;
    }
    
    trackLastTime[ chan ] = millis();
    
    unsigned int current = readCurrent( chan );
    unsigned int voltage = readVoltage( chan );

    long dC = (long) ( current - lastCurrent[ chan ] );
    long dV = (long) ( voltage - lastVoltage[ chan ] );
    
    double dvoltage = getVoltageFromCode( voltage, chan );
    double dcurrent = getCurrentFromCode( current, chan );
    
    Serial.println(noise_voltage[ chan ]);
    
    if( abs( dV ) < noise_voltage[ chan ] || abs( dC ) < noise_current[ chan ] ) {
        dV = 0;
        dC = 0;
    } else {
        lastVoltage[ chan ] = voltage;
        lastCurrent[ chan ] = current;
    }
    
    if( dV == 0 || dC == 0 ) {
        
        // Do nothing, leave duty unchanged
        
    } else if( dvoltage < 0 ) { // If voltage is negative
        
        // Always increase voltage.
        direction[ chan ] = 1;
    } else if ( dcurrent <= 0 ) {
        
        // Probably over MPPT, we have to come back
        direction[ chan ] = -1;
        
    } else {

        if( dC == 0 ) {

            direction[ chan ] = 1; // This is probably reverse bias
            
            // Leave duty[ chan ] unchanged
        } else {
        

           double dconductance = 1 + ( dvoltage / dcurrent ) / ( getdVoltageFromCode( dV, chan ) / getdCurrentFromCode( dC, chan ) ) ;
            
           if( dconductance > 0 ) { // Before MPP
               
                direction[ chan ] = 1;

            } else { // After MPP
                
                direction[ chan ] = -1;
                    
            }
        }
    }
    
    
    voltageMean[ chan ] = ( unsigned int ) ( ( ( long ) voltageMean[ chan ] * trackNb[ chan ] ) + voltage ) / ( trackNb[ chan ] + 1 );
    currentMean[ chan ] = ( unsigned int ) ( ( ( long ) currentMean[ chan ] * trackNb[ chan ] ) + current ) / ( trackNb[ chan ] + 1 );
    
    voltageMax[ chan ] = max( voltageMax[ chan ], voltage );
    voltageMin[ chan ] = min( voltageMin[ chan ], voltage );
    
    currentMax[ chan ] = max( currentMax[ chan ], current );
    currentMin[ chan ] = min( currentMin[ chan ], current );
    
    trackNb[ chan ] += 1;
    
    sendMPPT( chan );
    setVoltage( chan, voltageCode[ chan ] + ( direction[ chan ] * incrementVoltage[ chan ] ) );
   */
}

void DeviceBoard::trackMPP_steadyV( byte chan ) {
    
    
//    int direction = 0;
    
    if( millis() - trackLastTime[ chan ] < trackRate[ chan ] ) {
        return;
    }
    
    trackLastTime[ chan ] = millis();
    
    unsigned int current = readCurrent( chan );
    unsigned int voltage = readVoltage( chan );
    unsigned long dV = ( long ) voltage - (long ) lastVoltage[ chan ];
    
    
    if( abs( dV ) < noise_voltage[ chan ] ) {
        voltage = lastVoltage[ chan ];
    }

    if( voltage > targetVoltageCode[ chan ] ) {
       direction[ chan ] = -1;
    } else {
        direction[ chan ] = 1;
    }
    
    voltageMean[ chan ] =  ( ( ( unsigned long ) ( voltageMean[ chan ] ) * trackNb[ chan ] ) + voltage ) / ( trackNb[ chan ] + 1 );
    currentMean[ chan ] =  ( ( ( unsigned long ) ( currentMean[ chan ] ) * trackNb[ chan ] ) + current ) / ( trackNb[ chan ] + 1 );
    
    voltageMax[ chan ] = max( voltageMax[ chan ], voltage );
    voltageMin[ chan ] = min( voltageMin[ chan ], voltage );
    
    currentMax[ chan ] = max( currentMax[ chan ], current );
    currentMin[ chan ] = min( currentMin[ chan ], current );
    
    trackNb[ chan ] += 1;
    
    sendMPPT( chan );
    setVoltage( chan, voltageCode[ chan ] + ( direction[ chan ] * incrementVoltage[ chan ] ) );
}

void DeviceBoard::sendMPPT( byte chan ) {
    
    
    if( millis() - trackLastSend[ chan ] > trackSendRate[ chan ] ) {
        
        trackLastSend[ chan ] = millis();
        
        
        Serial.print( "<TRAC," );
        Serial.print( chan );
        Serial.print( "," );
        Serial.print( voltageMean[ chan ] );
        Serial.print( "," );
        Serial.print( currentMean[ chan ] );
        Serial.print( "," );
        Serial.print( voltageMin[ chan ] );
        Serial.print( "," );
        Serial.print( voltageMax[ chan ] );
        Serial.print( "," );
        Serial.print( currentMin[ chan ] );
        Serial.print( "," );
        Serial.print( currentMax[ chan ] );
        Serial.print( ">;" );
        Serial.flush();
        
        voltageMin[ chan ] = - 1;
        voltageMax[ chan ] = 0;
        
        currentMin[ chan ] = - 1;
        currentMax[ chan ] = 0;
        
        trackNb[ chan ] = 0;
    }
}


double DeviceBoard::getCurrentFromCode( unsigned int code, byte chan ) {
    return code * adc_slope_i[ chan ] + adc_offset_i[ chan ];
}

double DeviceBoard::getVoltageFromCode( unsigned int code, byte chan ) {
    return code * adc_slope_v[ chan ] + adc_offset_v[ chan ];
}


double DeviceBoard::getdCurrentFromCode( long dcode, byte chan ) {
    return dcode * adc_slope_i[ chan ];
}

double DeviceBoard::getdVoltageFromCode( long dcode, byte chan ) {
    return dcode * adc_slope_v[ chan ];
}


void DeviceBoard::muxChannel( byte chan ) {
   
    byte state1, state2, state3;

    
    switch( chan ) {
            
        case 0:
            state1 = 0;
            state2 = 1;
            state3 = 0;
            break;
        case 1:
            state1 = 1;
            state2 = 0;
            state3 = 0;
            break;
        case 2:
            state1 = 0;
            state2 = 0;
            state3 = 0;
            break;
        case 3:
            state1 = 1;
            state2 = 1;
            state3 = 0;
            break;
        case 4:
            state1 = 0;
            state2 = 0;
            state3 = 1;
            break;
        case 5:
            state1 = 0;
            state2 = 1;
            state3 = 1;
            break;
        case 6:
            state1 = 1;
            state2 = 1;
            state3 = 1;
            break;
        case 7:
            state1 = 1;
            state2 = 0;
            state3 = 1;
            break;
    }
    
    
    digitalWrite( MUXEN, 1 );
    digitalWrite( MUX_S1, state1 );
    digitalWrite( MUX_S2, state2 );
    digitalWrite( MUX_S3, state3 );
    digitalWrite( MUXEN, 0 );

}

void DeviceBoard::demuxChannel() {
    digitalWrite( MUXEN, 1 );
}

unsigned int DeviceBoard::readCurrent( byte chan ) {
    muxChannel( chan );
    return read( chan, 1 );
}


unsigned int DeviceBoard::readVoltage( byte chan ) {
    muxChannel( chan );
    return read( chan, 0 );
}

void DeviceBoard::selectADC() {
    
    unselect();
    digitalWrite( CS_ADC, 0 );
}

void DeviceBoard::selectDAC( byte channel ) {

    unselect();

    if( channel == 0 || channel == 1 ) {
        
        digitalWrite( CS_DAC_0, 0 );
    } else if( channel == 2 || channel == 3 ) {
        
       digitalWrite( CS_DAC_1, 0 );
    } else if( channel == 4 || channel == 5 ) {
        
        digitalWrite( CS_DAC_2, 0 );
    } else if( channel == 6 || channel == 7 ) {
        
        digitalWrite( CS_DAC_3, 0 );
    }
}

void DeviceBoard::unselect() {
    
    digitalWrite( CS_ADC, 1 );
    digitalWrite( CS_DAC_0, 1 );
    digitalWrite( CS_DAC_1, 1 );
    digitalWrite( CS_DAC_2, 1 );
    digitalWrite( CS_DAC_3, 1 );
}


unsigned int DeviceBoard::read( byte chan, byte mode ) {
    
    byte out1 = 0;
    byte out2 = 0;
    byte out3 = 0;
    byte out4 = 0;
    

    
    
    out1 |= B10000000; // Bit 1 - Continuous
    
    if( mode == 0 ) {
        
        out1 |= B00110000; // 011 = AINP:2, AINN:3
        
    } else { // Voltage
        
        out1 |= B00000000; // 000 = AINP:0, AINN: 1
    }
    
    out1 |= B00000100; // PGA 2.048V (010)
    out1 |= B00000001; // 1 = power down, single shot mode, 0 = continuous
    
    
   // out2 |= B11000000; // 128 SPS (3 bit)
    out2 |= B00000000; // 128 SPS (3 bit)
    
    out2 |= B00000000; // ADC Mode (1 = Temperature mode)
    out2 |= B00001000; // Enable pull-up
    out2 |= B00000010; // Write config (01 needed to write, otherwise ignored)
    out2 |= B00000001; // Always 1
    
    delay( 8 );

    selectADC( );

    SPI.beginTransaction( SPISettings( 50000, MSBFIRST, SPI_MODE1 ) );
    
    SPI.transfer( out1 );
    SPI.transfer( out2 );
    
    unselect();

    selectADC( );

    unsigned long startTime = millis();
    while( ( PINB  & B00010000 ) > 0 ) {

        //   while( ( REG_PIOA_PDSR  & 33554432 ) > 0 ) {
        if( ( millis() - startTime ) > 1000 ) {
            Serial.print("Error");
            return 2048;
        }
    }
    
    out1 = 0;
    out2 = 0;
    out3 = 0;
    out4 = 0;
    byte in1, in2, in3, in4;
    
    
    in1 = SPI.transfer( out1 );
    in2 = SPI.transfer( out2 );
    in3 = SPI.transfer( out3 );
    in4 = SPI.transfer( out4 );
    
    SPI.endTransaction();
    
    unselect();
    
    unsigned int code = ( ( (unsigned int) ( in1 << 8 ) ) | ( ( unsigned int ) ( in2 ) ) );
    
    // return current;
    unsigned int code_corrected = 0;
    
    if( code > 32767 ) {
        code_corrected = code - 32768;
    } else {
        code_corrected = code + 32768;
    }
    
    return code_corrected;
}



void DeviceBoard::makeIV( byte chan ) {
    
    
    if( iv_nbpoints[ chan ] > 100 ) {
        iv_nbpoints[ chan ] = 100;
    }
    
    int step = (int) ( ( iv_endvoltage[ chan ] - iv_startvoltage[ chan ] ) / ( ( iv_nbpoints[ chan ] / 2 ) - 1 ) );
    int delayiv = step / iv_scanrate[ chan ];
    int currentVoltage = iv_startvoltage[ chan ] - step;
    
    byte nb = 0;

    while( nb < iv_nbpoints[ chan ] ) {
        
        Serial.println( currentVoltage );
        Serial.println( step );
        
        setVoltage( chan, currentVoltage + step );
        
        delay( delayiv * 1000 );
        
        this->ivVoltage[ nb ] = readVoltage( chan );
//        this->ivVoltage[ nb ] = currentVoltage + step;
        this->ivCurrent[ nb ] = readCurrent( chan );
        nb += 1;
        
        currentVoltage = currentVoltage + step;
        
        if( nb == iv_nbpoints[ chan ] / 2 ) {
            step = - step;
        }
    }
    
    
    Serial.print("<IV,");
    Serial.print( chan );
    Serial.print(",");
    
    Serial.print( this -> iv_nbpoints[ chan ] );
        
    for (int i = 0; i < this->iv_nbpoints[ chan ]; i ++) {
        Serial.print( "," );
        Serial.print( this->ivVoltage[ i ] );
    }
    
    for (int i = 0; i < this->iv_nbpoints[ chan ]; i ++) {
        Serial.print( "," );
        Serial.print( this->ivCurrent[ i ] );
    }
    
    Serial.println(">;");
    
}



void DeviceBoard::setVoltage( byte chan, unsigned int code ) {
    
    //code = min( 3000, max( 1000 , code ) );
    
    if( code < 0 ) {
        code = 0;
    }
    
    if( code > 4095 ) {
        code = 4095;
    }
    
    voltageCode[ chan ] = code;

    byte prog = 0;
    prog |= 00000000;   // XX - 000 - 000
    
    switch( chan % 2 ) {
        case 0:
            prog |= 001;        // XX011000 == Write to A
            break;
            
        case 1:
            prog |= 000;        // XX011001 == Write to B
            break;
    }
    
    code = code << 4;
    byte val2 = code;
    byte val1 = code >> 8;
    
    
    shiftToDAC( chan, prog, val1, val2 );
    unselect();
    shiftToDAC( chan, B00001111, 0, 0 );
    unselect();
    
}

void DeviceBoard::configureDAC( byte chan ) {

    
    byte prog, val1, val2;
    
    // Programming external reference
    prog = 0;
    prog |= B00111000;
    val1 = 0;
    val2 = 0;
    shiftToDAC( chan, prog, val1, val2 );
    
    
    
    // Programming LDAC mode
    prog = 0;
    prog |= B00110000;
    val1 = 0;
    val2 = 0;
    shiftToDAC( chan, prog, val1, val2 );
 
    
}


void DeviceBoard::shiftToDAC( byte chan, byte byte1, byte byte2, byte byte3 ) {

    selectDAC( chan );
    digitalWrite( LDAC, 1 );
    SPI.beginTransaction( SPISettings( 400000, MSBFIRST, SPI_MODE1 ) );
    SPI.transfer( byte1 );
    SPI.transfer( byte2 );
    SPI.transfer( byte3 );
    SPI.endTransaction();
    digitalWrite( LDAC, 0 );
    unselect();

}





#include "Arduino.h"
#include "DeviceBoard.h"
#include "SPI.h"

DeviceBoard::DeviceBoard( )
{

}

void DeviceBoard::init() {
    
}

void DeviceBoard::loop( byte chan ) {

    // MPPT Mode
    switch( mode[ chan ] ) {
            
        case 1:
            trackMPP_PO( chan );
        break;
            
        case 2:
             trackMPP_incrC( chan );
        break;
            
        case 3:
            trackMPP_steadyV( chan );
        break;
            
        case 5:
            trackVoc( chan );
        break;
            
    }
}


void DeviceBoard::holdAtVoltage() {
    
    /*
    if( millis() - MPPTlastTrackMilli < MPPTinterval ) {
        return false;
    }
    
    
    MPPTlastTrackMilli = millis();
    
    double current = readCurrent();
    bool direction;
    
    bC[ MPPTNb ] = round( current * 1000000 );
    bufferVoltages[ MPPTNb ] = round( voltage * 1000000 );
    bufferPowers[ MPPTNb ] = round( current * voltage * 1000000 );
    
    MPPTPowerMean = ( ( MPPTPowerMean * MPPTNbSend ) + ( current * voltage * 1000000 ) ) / ( MPPTNbSend + 1 );
    MPPTCurrentMean = ( ( MPPTCurrentMean * MPPTNbSend ) + ( current * 1000000 ) ) / ( MPPTNbSend + 1 );
    MPPTVoltageMean = ( ( MPPTVoltageMean * MPPTNbSend ) + ( voltage * 1000000 ) ) / ( MPPTNbSend + 1 );
    MPPTPowerMax = max( MPPTPowerMax, ( current * voltage * 1000000 ) );
    MPPTCurrentMax = max( MPPTCurrentMax, ( current * 1000000 ) );
    MPPTVoltageMax = max( MPPTVoltageMax, ( voltage * 1000000 ) );
    
    
    MPPTPowerMin = min( MPPTPowerMin, ( current * voltage * 1000000 ) );
    MPPTCurrentMin = min( MPPTCurrentMin, ( current * 1000000 ) );
    MPPTVoltageMin = min( MPPTVoltageMin, ( voltage * 1000000 ) );
    
    MPPTNbSend += 1;
    
    if( MPPTSendRate > -2 ) {
        
        if( millis() - lastSent > MPPTSendRate || MPPTSendRate == -1 ) {
            lastSent = millis();
            
            int cmean = MPPTCurrentMean;
            int pmean =  MPPTPowerMean;
            int vmean = MPPTVoltageMean;
            
            int cmax = MPPTCurrentMax;
            int pmax = MPPTPowerMax;
            int vmax = MPPTVoltageMax;
            
            int cmin = MPPTCurrentMin;
            int pmin = MPPTPowerMin;
            int vmin = MPPTVoltageMin;
            
            int _id = chanNum;
            
            String d = "5,";
            d = d + _id;
            d = d + ",";
            d = d + cmean;
            d = d + ",";
            d = d + vmean;
            d = d + ",";
            d = d + pmean;
            d = d + ",";
            d = d + cmin;
            d = d + ",";
            d = d + cmax;
            d = d + ",";
            d = d + vmin;
            d = d + ",";
            d = d + vmax;
            d = d + ",";
            d = d + pmin;
            d = d + ",";
            d = d + pmax;
            d = d + ";";
            
            SerialUSB.print( d );
            SerialUSB.flush();
            
            resetMPPTCumulatedData();
        }
    }
    
    
    setVoltage( this->holdVoltage );
    
    
    return false;
    */
    
}

bool DeviceBoard::isEnabled( byte chan ) {
    return mode[ chan ] > 0;
}


void DeviceBoard::trackMPP_PO( byte chan ) {
    
    int direction = 0;
    
    
    if( millis() - trackLastTime[ chan ] < trackRate[ chan ] ) {
        return;
    }
    
    trackLastTime[ chan ] = millis();
    
    unsigned int current = readCurrent( chan );
    //    int voltage = readVoltage( chan );
    int voltage = voltageCode[ chan ];
    
    int dV = voltage - lastVoltage[ chan ];
    double power = getCurrentFromCode( current, chan ) * getVoltageFromCode( voltage, chan );
    double difference = power - lastPower[ chan ];
    /*
     Serial.println("--");
     Serial.println(dV);
     Serial.println( power * 1000000 );
     Serial.println("__");
     Serial.println( lastPower[ chan ] * 1000000 );
     Serial.println("--");
     */
    
    if( dV == 0 ) {
        
        direction = -1;
        
    } else if( difference == 0 ) {
        lastPower[ chan ] = power;
        if( dV >= 0 ) {
            direction = 1;
        } else {
            direction = -1;
        }
    } else if( difference > 0 ) {
        //    Serial.println( difference );
        lastPower[ chan ] = power;
        if( dV >= 0 ) {
            direction = 1;
        } else {
            direction = -1;
        }
    } else {
        
        double ratio = (double) (  difference / ( lastPower[ chan ] ) );
        //     Serial.println( ratio * 100 );
        Serial.println("DECRE");
        Serial.println( ratio * 1000 );
        if( ratio < -0.1 ) {
            
            Serial.println("INVERT");
            lastPower[ chan ] = power;
            if( dV < 0 ) {
                direction = 1;
            } else {
                direction = -1;
            }
            
        } else {
            
            if( dV >= 0 ) {
                direction = 1;
            } else {
                direction = -1;
            }
        }
    }
    
    voltageMean[ chan ] = ( int ) ( ( ( long ) voltageMean[ chan ] * trackNb[ chan ] ) + voltage ) / ( trackNb[ chan ] + 1 );
    currentMean[ chan ] = ( int ) ( ( ( long ) currentMean[ chan ] * trackNb[ chan ] ) + current ) / ( trackNb[ chan ] + 1 );
    
    voltageMax[ chan ] = max( voltageMax[ chan ], voltage );
    voltageMin[ chan ] = min( voltageMin[ chan ], voltage );
    
    currentMax[ chan ] = max( currentMax[ chan ], current );
    currentMin[ chan ] = min( currentMin[ chan ], current );
    
    trackNb[ chan ] += 1;
    
    sendMPPT( chan );
    
    lastCurrent[ chan ] = current;
    lastVoltage[ chan ] = voltage;
    
    setVoltage( chan, voltageCode[ chan ] + ( direction * incrementVoltage[ chan ] ) );
    
}

// Used incremental conductance to track maximum power output
void DeviceBoard::trackMPP_incrC( byte chan ) {
    
    int direction = 0;
            Serial.println("here");
    if( millis() - trackLastTime[ chan ] < trackRate[ chan ] ) {
        return;
    }
    
    trackLastTime[ chan ] = millis();
    
    unsigned int current = readCurrent( chan );
    //    int voltage = readVoltage( chan );
    int voltage = voltageCode[ chan ];
    
    int dC = current - lastCurrent[ chan ];
    int dV = voltage - lastVoltage[ chan ];
    
    int currentNoiseBit = 4;
    int voltageNoiseBit = 4;

    
    if( abs( dV ) < voltageNoiseBit ) {
        dV = 0;
    } else {
        lastVoltage[ chan ] = voltage;
    }
    
    if( abs( dC ) < currentNoiseBit ) {
        dC = 0;
    } else {
        lastCurrent[ chan ] = current;
    }
    
    if( dV == 0 ) {
        
        Serial.println("dV=0");
        if( dC == 0 ) {
            // Leave duty[ chan ] unchanged
        } else if( dC > 0 ) {
        //    duty[ chan ] = -1;
        } else {
            duty[ chan ] = - duty[ chan ];
        }
        
    } else {

        if( dC == 0 ) {
            Serial.println("dC=0");
            
            duty[ chan ] = 1; // This is probably reverse bias
            
            // Leave duty[ chan ] unchanged
        } else {
        

            double dconductance = (double) dC / dV - ( (double) - ( current + (double) ( adc_offset[ chan ] / adc_slope[ chan ] ) ) / ( voltage + (double) ( dac_offset[ chan ] / dac_slope[ chan ] ) ) );
            
            Serial.println( dconductance * 1000000 );
            
            double voltage = getVoltageFromCode( voltage, chan );
            
                if( fabs( dconductance ) < 0.5 ) { // 0.5 bit => We are at MPP
                // Leave duty[ chan ] unchanged

                } else if( dconductance > 0.5 ) { // Further than MPP
                    
                    if( voltage < 0 ) {
                        duty[ chan ] = -1;
                    } else {
                        duty[ chan ] = 1;
                    }
                } else {
                    
                    if( voltage < 0 ) {
                        duty[ chan ] = -1;
                    } else {
                        duty[ chan ] = 1;
                    }
                }

            
        }
    }
    
    
    voltageMean[ chan ] = ( int ) ( ( ( long ) voltageMean[ chan ] * trackNb[ chan ] ) + voltage ) / ( trackNb[ chan ] + 1 );
    currentMean[ chan ] = ( int ) ( ( ( long ) currentMean[ chan ] * trackNb[ chan ] ) + current ) / ( trackNb[ chan ] + 1 );
    
    voltageMax[ chan ] = max( voltageMax[ chan ], voltage );
    voltageMin[ chan ] = min( voltageMin[ chan ], voltage );
    
    currentMax[ chan ] = max( currentMax[ chan ], current );
    currentMin[ chan ] = min( currentMin[ chan ], current );
    
    trackNb[ chan ] += 1;
    
    sendMPPT( chan );
    setVoltage( chan, voltageCode[ chan ] + ( duty[ chan ] * incrementVoltage[ chan ] ) );
}

void DeviceBoard::trackMPP_steadyV( byte chan ) {
    
    
    int direction = 0;
    
    if( millis() - trackLastTime[ chan ] < trackRate[ chan ] ) {
        return;
    }
    
    trackLastTime[ chan ] = millis();
    
    unsigned int current = readCurrent( chan );
    //    int voltage = readVoltage( chan );
    int voltage = voltageCode[ chan ];
    
    int dV = voltage - lastVoltage[ chan ];
    int voltageNoiseBit = 3;

    
    if( abs( dV ) < voltageNoiseBit ) {
        dV = 0;
    } else {
        lastVoltage[ chan ] = voltage;
    }
    
    if( abs( voltage - trackVoltage[ chan ] ) < voltageNoiseBit )  {
        // Do not change voltage
        duty[ chan ] = 0;
    } if( voltage > trackVoltage[ chan ] ) {
        duty[ chan ] = -1;
    } else {
        duty[ chan ] = 1;
    }
    
    voltageMean[ chan ] = ( int ) ( ( ( long ) voltageMean[ chan ] * trackNb[ chan ] ) + voltage ) / ( trackNb[ chan ] + 1 );
    currentMean[ chan ] = ( int ) ( ( ( long ) currentMean[ chan ] * trackNb[ chan ] ) + current ) / ( trackNb[ chan ] + 1 );
    
    voltageMax[ chan ] = max( voltageMax[ chan ], voltage );
    voltageMin[ chan ] = min( voltageMin[ chan ], voltage );
    
    currentMax[ chan ] = max( currentMax[ chan ], current );
    currentMin[ chan ] = min( currentMin[ chan ], current );
    
    trackNb[ chan ] += 1;
    
    sendMPPT( chan );
    setVoltage( chan, voltageCode[ chan ] + ( duty[ chan ] * incrementVoltage[ chan ] ) );
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


double DeviceBoard::getCurrentFromCode( int code, byte chan ) {
    return code * adc_slope[ chan ] + adc_offset[ chan ];
}

double DeviceBoard::getVoltageFromCode( int code, byte chan ) {
    return code * dac_slope[ chan ] + dac_offset[ chan ];
}

void DeviceBoard::trackVoc( byte chan ) {

    /*
    if( millis() - trackLastTime[ chan ] < trackRate[ chan ] ) {
        return false;
    }
    
    trackLastTime[ chan ] = millis();
    
    int current = readCurrent();
    int voltage = readVoltage();*/
    
/*    if( MPPTSendRate > -2 ) {
        
        if( millis() - lastSent > MPPTSendRate || MPPTSendRate == -1 ) {
            lastSent = millis();
            
            int _id = chanNum;
            
            String d = "<Voc,";
            d = d + _id;
            d = d + ",";
            d = d + ( int ) voltage * 1000000;
            d = d + ">;";
            
            SerialUSB.print( d );
            SerialUSB.flush();
            
        }
    }
    */
    /*
    if( current < 0 ) {
        incrementVoltageCode( -this->MPPTstep );
    } else {
        incrementVoltageCode( this->MPPTstep );
    }
    
    return false;
     */
}

unsigned int DeviceBoard::readCurrent( byte chan ) {
    
    byte out1 = 0;
    byte out2 = 0;
    byte out3 = 0;
    byte out4 = 0;
    
    out1 |= B10000000; // Bit 1 - Continuous
    
    switch( chan % 2 ) {
            
        case 1:
            out1 |= B00000000;
            break;
            
        case 0:
            out1 |= B00110000;
            break;
            
            
    }
    
    out1 |= B00000100; // PGA 2.048V (010)
    out1 |= B00000001; // 1 = power down, single shot mode, 0 = continuous
    
    
    out2 |= B11000000; // 128 SPS (3 bit)
    out2 |= B00000000; // ADC Mode (1 = Temperature mode)
    out2 |= B00001000; // Enable pull-up
    out2 |= B00000010; // Write config (01 needed to write, otherwise ignored)
    out2 |= B00000001; // Always 1
    
    selectADC( chan );
    delay( 1 );
    
    SPI.beginTransaction( SPISettings( 50000, MSBFIRST, SPI_MODE1 ) );
    
    SPI.transfer( out1 );
    SPI.transfer( out2 );
    
    
    unselect();
    selectADC( chan );
    
    
    
    //    Serial.println( digitalRead( 74 ) );
    

    unsigned long startTime = millis();
    
 //   while( ( PINB  & B00001000 ) > 0 ) {
    while( ( REG_PIOA_PDSR  & 33554432 ) > 0 ) {
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
    
    unsigned int current = ( ( in1 << 4 | ( in2 >> 4 ) ) );

   // return current;
    unsigned int current_corrected = 0;
    
    if( current > 2047 ) {
        current_corrected = current - 2048;
    } else {
        current_corrected = current + 2048;
    }
    
    return current_corrected;

}




int DeviceBoard::readVoltage( byte chan ) {
    
    byte out1 = 0;
    byte out2 = 0;
    byte out3 = 0;
    byte out4 = 0;
    
    out1 |= B10000000; // Bit 1 - Continuous
    
    switch( chan % 2 ) {
            
        case 1:
            out1 |= B00000000;
            break;
            
        case 0:
            out1 |= B00110000;
            break;
            
            
    }
    
    out1 |= B00000100; // PGA 2.048V (010)
    out1 |= B00000001; // 1 = power down, single shot mode, 0 = continuous
    
    
    out2 |= B11000000; // 128 SPS (3 bit)
    out2 |= B00000000; // ADC Mode (1 = Temperature mode)
    out2 |= B00001000; // Enable pull-up
    out2 |= B00000010; // Write config (01 needed to write, otherwise ignored)
    out2 |= B00000001; // Always 1
    
   selectADC( chan );
    
    SPI.beginTransaction( SPISettings( 50000, MSBFIRST, SPI_MODE1 ) );
    
    SPI.transfer( out1 );
    SPI.transfer( out2 );
    
    unselect();
    
    unsigned long startTime = millis();
    unselect();
    selectADC( chan );
    
    
    //    Serial.println( digitalRead( 74 ) );
   // while( ( PINB  & B00001000 ) > 0 ) {
    while( ( REG_PIOA_PDSR  & 33554432 ) > 0 ) {
        
        if( ( millis() - startTime ) > 500 ) {
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
    
    return ( ( in1 << 4 | ( in2 >> 4 ) ) );
}




void DeviceBoard::makeIV( byte chan ) {
    
    
    if( iv_nbpoints[ chan ] > 100 ) {
        iv_nbpoints[ chan ] = 100;
    }
    
    int step = ( iv_endvoltage[ chan ] - iv_startvoltage[ chan ] ) / ( ( iv_nbpoints[ 8 ] / 2 ) - 1 );
    int delayiv = step / iv_scanrate[ chan ];
    int currentVoltage = iv_startvoltage[ chan ] - step;
    
    byte nb = 0;

    while( nb < iv_nbpoints[ chan ] ) {
        
        setVoltage( chan, currentVoltage + step );
        
        delay( delayiv );
        
//        this->ivVoltage[ nb ] = readVoltage( chan );
        this->ivVoltage[ nb ] = currentVoltage + step;
        this->ivCurrent[ nb ] = readCurrent( chan );
        nb += 1;
        
        currentVoltage = currentVoltage + step;
        
        if( nb == iv_nbpoints[ chan ] / 2 ) {
            step = - step;
        }
    }
    /*
    
    SerialUSB.print("<IV,");
    SerialUSB.print( chanNum );
    SerialUSB.print(",");
    
    SerialUSB.print( this -> ivnbpoints );
        
    for (int i = 0; i < this->ivnbpoints; i ++) {
        SerialUSB.print( "," );
        SerialUSB.print( round( this->bufferVoltages[ i ] ) );
    }
    
    for (int i = 0; i < this->ivnbpoints; i ++) {
        SerialUSB.print( "," );
        SerialUSB.print( round( this->bC[ i ] ) );
    }
    
    SerialUSB.println(">;");
     */
}



void DeviceBoard::setVoltage( byte chan, unsigned int code ) {
    
    //code = min( 3000, max( 1000 , code ) );
                   
    voltageCode[ chan ] = code;

    byte prog = 0;
    
    prog |= 00000000;   // XX - 000 - 000
    
    switch( chan % 2 ) {
        case 0:
            prog |= 000;        // XX011000 == Write to A
            break;
            
        case 1:
            prog |= 001;        // XX011001 == Write to B
            break;
    }
    
    
    code = code << 4;
    byte val2 = code;
    byte val1 = code >> 8;
    
    selectDAC( chan );
    shiftToDAC( chan, prog, val1, val2 );
    writeToDAC();
    
    unselect();
    selectDAC( chan );
    shiftToDAC( chan, B00001111, 0, 0 );
    writeToDAC();
    unselect();
    
}


void DeviceBoard::assignPinMux( int pinEn, int pinA, int pinB, int pinC, int pinD ) {
    
    pin_MUX_Enable = pinEn;
    pin_MUXA = pinA;
    pin_MUXB = pinB;
    pin_MUXC = pinC;
    pin_MUXD = pinD;
    
    pinMode( pinEn, OUTPUT );
    pinMode( pinA, OUTPUT );
    pinMode( pinB, OUTPUT );
    pinMode( pinC, OUTPUT );
    pinMode( pinD, OUTPUT );
}

void DeviceBoard::assignPinDLatch( int pinEn, int pinOEn, int pinA, int pinB, int pinC, int pinD ) {
    
    pin_DLatch_Enable = pinEn;
    pin_DLatch_OEnable = pinOEn;
    pin_DLatchA = pinA;
    pin_DLatchB = pinB;
    pin_DLatchC = pinC;
    pin_DLatchD = pinD;
    
    pinMode( pinEn, OUTPUT );
    pinMode( pinOEn, OUTPUT );
    pinMode( pinA, OUTPUT );
    pinMode( pinB, OUTPUT );
    pinMode( pinC, OUTPUT );
    pinMode( pinD, OUTPUT );
    
}

void DeviceBoard::assignPinDAC( int pinLDAC, int pinCLEAR ) {
    
    pin_DAC_LDAC = pinLDAC;
    pin_DAC_CLEAR = pinCLEAR;
    
    
    pinMode( pin_DAC_LDAC, OUTPUT );
    pinMode( pin_DAC_CLEAR, OUTPUT );
    
    digitalWrite( pin_DAC_LDAC, HIGH );
    digitalWrite( pin_DAC_CLEAR, HIGH );
    
}

void DeviceBoard::selectDAC( byte chan ) {
    
    int stateA;
    int stateB;
    int stateC;
    int stateD;
    
    switch( chan ) {
        case 0:
        case 1:
            
            stateA = 1;
            stateB = 0;
            stateC = 0;
            stateD = 1;
            break;
            
            
        case 2:
        case 3:
            stateA = 0;
            stateB = 1;
            stateC = 0;
            stateD = 1;
            break;
            
            
        case 4:
        case 5:
            
            stateA = 0;
            stateB = 0;
            stateC = 1;
            stateD = 1;
            break;
            
        case 6:
        case 7:
            stateA = 0;
            stateB = 1;
            stateC = 1;
            stateD = 1;
            break;
            
            
    }
    
    
    
    digitalWrite( pin_MUXA, stateA );
    digitalWrite( pin_MUXB, stateB );
    digitalWrite( pin_MUXC, stateC );
    digitalWrite( pin_MUXD, stateD );
    
    digitalWrite( pin_MUX_Enable, 0 );
}

void DeviceBoard::writeToDAC() {
    digitalWrite( pin_DAC_LDAC, 0 );
    delay( 1 );
    digitalWrite( pin_DAC_LDAC, 1 );
}

void DeviceBoard::selectADC( byte chan ) {
    
    int stateA;
    int stateB;
    int stateC;
    int stateD;
    
    switch( chan ) {
        case 0:
        case 1:
            
            stateA = 0;
            stateB = 0;
            stateC = 0;
            stateD = 1;
            break;
            
            
        case 2:
        case 3:
            stateA = 1;
            stateB = 1;
            stateC = 0;
            stateD = 1;
            break;
            
            
        case 4:
        case 5:
            
            stateA = 1;
            stateB = 0;
            stateC = 1;
            stateD = 1;
            break;
            
        case 6:
        case 7:
            stateA = 1;
            stateB = 1;
            stateC = 1;
            stateD = 1;
            break;
            
            
    }
    
    digitalWrite( pin_MUXA, stateA );
    digitalWrite( pin_MUXB, stateB );
    digitalWrite( pin_MUXC, stateC );
    digitalWrite( pin_MUXD, stateD );
    
    
    digitalWrite( pin_MUX_Enable, 0 );
}


void DeviceBoard::unselect() {
    digitalWrite( pin_MUX_Enable, 1 );
}


void DeviceBoard::enableChannel( byte chan ) {

    updateDLatch( chan, 1 );
    delay( 1 );
    configureDAC( chan );
}

void DeviceBoard::configureDAC( byte chan ) {

    
    byte prog, val1, val2;
    
    digitalWrite( pin_DAC_LDAC, 0 );
    // Programming external reference
    prog = 0;
    prog |= B00111000;
    val1 = 0;
    val2 = 0;
    shiftToDAC( chan, prog, val1, val2 );
    
    
    digitalWrite( pin_DAC_LDAC, 0 );
    // Programming LDAC mode
    prog = 0;
    prog |= B00110000;
    val1 = 0;
    val2 = 0;
    shiftToDAC( chan, prog, val1, val2 );
    /*
     
     digitalWrite( pin_DAC_LDAC, 0 );
     // Power down
     prog = 0;
     prog |= B00100000;
     val1 = 0;
     val2 = 0;
     val2 |= B00010011;
     shiftToDAC( chanNum, prog, val1, val2 );
     
     */
    
    digitalWrite( pin_DAC_LDAC, 1 );
    
}


void DeviceBoard::shiftToDAC( byte chan, byte byte1, byte byte2, byte byte3 ) {
    
    //    Serial.println("SPI");
    selectDAC( chan );
    SPI.beginTransaction( SPISettings( 4000000, MSBFIRST, SPI_MODE1 ) );
    SPI.transfer( byte1 );
    SPI.transfer( byte2 );
    SPI.transfer( byte3 );
    SPI.endTransaction();
    unselect();
}


void DeviceBoard::updateDLatch( byte chan, int value ) {
    
    
    switch( chan ) {
            
        case 0:
        case 1:
            pin_DLatchA_Val = value;
            break;
            
            
        case 2:
        case 3:
            pin_DLatchB_Val = value;
            break;
            
            
        case 4:
        case 5:
            pin_DLatchC_Val = value;
            break;
            
            
        case 6:
        case 7:
            pin_DLatchD_Val = value;
            break;
    }
    
    
    
    digitalWrite( pin_DLatchA, pin_DLatchA_Val );
    digitalWrite( pin_DLatchB, pin_DLatchB_Val );
    digitalWrite( pin_DLatchC, pin_DLatchC_Val );
    digitalWrite( pin_DLatchD, pin_DLatchD_Val );
    
    digitalWrite( pin_DLatch_OEnable, 0 );
    digitalWrite( pin_DLatch_Enable, 1 );
    delay( 1 );
    digitalWrite( pin_DLatch_Enable, 0 );
}




/*
 DeviceBoard.h - Library for measuring devices
 Created by Norman Pellet
 Released into the public domain.
 */

#ifndef SolarCell_h
#define SolarCell_h

// Uses SPI
#include "SPI.h"

#include <inttypes.h>
#if ARDUINO >= 100
#include <Arduino.h>
#else
#include <WProgram.h>
#endif

class DeviceBoard {
  
public:
    
    DeviceBoard( );
    
    
    double dac_offset[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double dac_slope[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double adc_offset[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double adc_slope[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    unsigned int ivVoltage[ 100 ];
    unsigned int ivCurrent[ 100 ];
    
    unsigned int trackSendRate[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int trackRate[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    unsigned int lastVoltage[ 8 ] = { 2047, 2047, 2047, 2047, 2047,2047, 2047, 2047 };
    unsigned int lastCurrent[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double lastPower[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    unsigned int voltageMean[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int currentMean[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    unsigned int voltageMin[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int voltageMax[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int currentMin[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int currentMax[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    unsigned int iv_startvoltage[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int iv_endvoltage[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int iv_scanrate[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int iv_nbpoints[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int iv_delay[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    unsigned int trackNb[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    byte duty[ 8 ] = { 1, 1, 1, 1, 1, 1, 1, 1 };
    
    unsigned int trackVoltage[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    byte mode[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    void loop( byte chan );
    void holdAtVoltage();
    
    void init();
    
    void trackMPP_PO( byte chan );
    void trackMPP_incrC( byte chan );
    void trackMPP_steadyV( byte chan );
    void sendMPPT( byte chan );
    
    void trackVoc( byte chan );
    
    unsigned int readCurrent( byte chan );
    int readVoltage( byte chan );
    
    bool isEnabled( byte chan );
    
    void makeIV( byte chan );
    void setVoltage( byte chan, unsigned int voltageCode );
    void shiftToDAC( byte b1, byte b2, byte b3 );

    
    void assignPinDAC( int pinA, int pinB );
    void assignPinMux( int pinEn, int pinA, int pinB, int pinC, int pinD );
    void assignPinDLatch( int pinEn, int pinOEn, int pinA, int pinB, int pinC, int pinD );
    
    void configureDAC( byte chanNum );
    void shiftToDAC( byte chanNum, byte byte1, byte byte2, byte byte3 );
    
    void selectDAC( byte chanNum );
    void writeToDAC();
    void selectADC( byte chanNum );
    void unselect();
    void enableChannel( byte channel );
    void updateDLatch( byte channel, int value );

    double getVoltageFromCode( int code, byte chan );
    double getCurrentFromCode( int code, byte chan );
    
    private:
    
        unsigned long trackLastTime[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
        unsigned long trackLastSend[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
        unsigned int voltageCode[ 8 ] = { 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047 };
    
        unsigned int incrementVoltage[ 8 ] = { 2, 2, 2, 2, 2, 2, 2, 2 };
    
        int pin_MUX_Enable;
        int pin_MUXA;
        int pin_MUXB;
        int pin_MUXC;
        int pin_MUXD;
    
        int pin_DLatch_Enable;
        int pin_DLatch_OEnable;
        int pin_DLatchA;
        int pin_DLatchB;
        int pin_DLatchC;
        int pin_DLatchD;
    
        int pin_DLatchA_Val;
        int pin_DLatchB_Val;
        int pin_DLatchC_Val;
        int pin_DLatchD_Val;
    
        int pin_DAC_LDAC;
        int pin_DAC_CLEAR;
    
    
    
  };

#endif
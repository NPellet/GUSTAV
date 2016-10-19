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
    
    // Calibration of the ADC
    double adc_offset_v[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double adc_slope_v[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double adc_offset_i[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double adc_slope_i[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    // Power regulation thresholds
    double regulationPos[ 8 ] = { 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01 };
    double regulationNeg[ 8 ] = { 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01 };
    
    // Storage space for the i-V curves
    unsigned int ivVoltage[ 100 ];
    unsigned int ivCurrent[ 100 ];
    
    // MPPT: sending rate to computer
    unsigned int trackSendRate[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    // MPPT: trakcing rage
    unsigned int trackRate[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    // MPPT: number of tracked data
    unsigned int trackNb[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    // MPPT: increment voltage (in code)
    unsigned int incrementVoltage[ 8 ] = { 2, 2, 2, 2, 2, 2, 2, 2 };
    
    
    // Last values
    unsigned int lastVoltage[ 8 ] = { 2047, 2047, 2047, 2047, 2047,2047, 2047, 2047 };
    unsigned int lastCurrent[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    double lastPower[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    // Mean values
    unsigned int voltageMean[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int currentMean[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    // Min and max values
    unsigned int voltageMin[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int voltageMax[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int currentMin[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int currentMax[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };

    // Noise values
    unsigned int noise_voltage[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int noise_current[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    // j-V scan parameters
    unsigned int iv_startvoltage[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int iv_endvoltage[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int iv_scanrate[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    byte iv_nbpoints[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    unsigned int iv_delay[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    // MPPT: Mode 3
    unsigned int targetVoltageCode[ 8 ] = { 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047 };
    
    
    
    
    byte mode[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    void check( byte chan );
    void holdAtVoltage();
    
    void init();
    
    void trackMPP_PO( byte chan );
    void trackMPP_incrC( byte chan );
    void trackMPP_steadyV( byte chan );
    void sendMPPT( byte chan );
    
    
    unsigned int read( byte chan, byte mode );
    unsigned int readVoltage( byte chan );
    unsigned int readCurrent( byte chan );
    
    bool isEnabled( byte chan );
    
    void makeIV( byte chan );
    void setVoltage( byte chan, unsigned int voltageCode );
    void shiftToDAC( byte b1, byte b2, byte b3 );
    
    void configureDAC( byte chanNum );
    void shiftToDAC( byte chanNum, byte byte1, byte byte2, byte byte3 );

    void selectADC();
    void unselect();
    void selectDAC( byte chanNum );
    
    double getVoltageFromCode( unsigned int code, byte chan );
    double getCurrentFromCode( unsigned int code, byte chan );
    
    double getdVoltageFromCode( long dcode, byte chan );
    double getdCurrentFromCode( long dcode, byte chan );
    
    int direction[ 8 ] = { 1, 1, 1, 1, 1, 1, 1, 1 };
    
    private:
    
    void muxChannel( byte channel );
    void demuxChannel();
    
        unsigned long trackLastTime[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
        unsigned long trackLastSend[ 8 ] = { 0, 0, 0, 0, 0, 0, 0, 0 };
    
    unsigned int voltageCode[ 8 ] = { 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047 };
    
    
  };

#endif
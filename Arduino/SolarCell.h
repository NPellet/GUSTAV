/*
 Device.h - Library for measuring devices
 Created by Norman Pellet
 Released into the public domain.
 */
#ifndef SolarCell_h
#define SolarCell_h


#include <inttypes.h>
#if ARDUINO >= 100
#include <Arduino.h>
#else
#include <WProgram.h>
#endif


class SolarCell
{

  public:
    SolarCell (int DACPin, int DACSync, int DACClk, int ADCCS, int ADCClk, int ADCSDIn, int ADCSDOut, int ADCChannel );
    bool MPPT();
    int getADCSDPin();
    int getADCCSPin();
    double getVoltageFromCode( int code );
    double getCurrentFromCode( int code );
    void setInterval( int interval );
    void setDACCalibration( double Slope, double Offset );
    void setADCCalibration( double Slope, double Offset );
    
    void makeIV( double startVoltage, double stopVoltage, int nbPoints, int settlingTime, int equilibrationTime );
    
        
    void configureCurrent();
    void measureCurrent();
    int getCurrentCode();
    int currentReady();
    int voltageCode;
    double voltage;
    void setRate( long rate );
    void setDAC( int code );

  private:
  	int shiftIO( int dataInPin, int dataOutPin, int clockPin, int dataOut );
    void printDouble( double val, unsigned int precision );
    void incrementVoltageCode( int byHowMuch );
    int getCodeFromVoltage( double voltage );
    void setVoltage( double voltage );
    int DACPin;
    int DACSync;
    int DACClk;
    int ADCCS;
    int ADCClk;
    int ADCSDIn;
    int ADCSDOut;
    int ADCChannel;
    double _rate;
    double DACSlope;
    double DACOffset;
    double ADCSlope;
    double ADCOffset;
    
    double current;
    double lastPower;
    int lastCurrentCode;
    int currentCode;
    double lastVoltage;
    
    bool MPPTdirection;
    unsigned long lastTrackMilli;
    unsigned long interval;
    int step;
    
    unsigned long lastSentMilli;
    
    double ivvoltages[ 100 ];
    double ivcurrents[ 100 ];
    double ivvoltagestep;
    int ivsettlingTime;
    int ivnb;
    int ivnbpoints;
    
    int mode;
};

#endif
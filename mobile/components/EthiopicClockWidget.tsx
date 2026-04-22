import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { formatEthiopianDate, formatEthiopianTime } from '../dateUtils';

export const EthiopicClockWidget = React.memo(({ C }: { C: any }) => {
  const [timeObj, setTimeObj] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTimeObj(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fullEtTime = formatEthiopianTime(timeObj);
  const [etTime, etSuffix] = fullEtTime.split(' ');

  const gregDateStr = timeObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ethpoianDateStr = formatEthiopianDate(timeObj); 
  const amhDays = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "አርብ", "ቅዳሜ"];
  const ethDayName = amhDays[timeObj.getDay()];

  return (
    <View style={{
      width: '100%',
      backgroundColor: C.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }}>
      <View style={{ 
        position: 'absolute', top: -40, right: -40, width: 140, height: 140, 
        borderRadius: 70, backgroundColor: C.accent, opacity: 0.05 
      }} />
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 38, fontWeight: '700', color: C.text, letterSpacing: -1 }}>{etTime}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted, marginLeft: 6 }}>{etSuffix}</Text>
          </View>
          <Text style={{ fontSize: 13, color: C.muted, marginTop: 2, fontWeight: '500' }}>{gregDateStr}</Text>
        </View>

        <View style={{ width: 1, height: 40, backgroundColor: C.border, marginHorizontal: 12 }} />

        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.accent, marginBottom: 2 }}>{ethDayName}</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>{ethpoianDateStr}</Text>
        </View>
      </View>
    </View>
  );
});

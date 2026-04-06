import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, FlatList } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';

export const PremiumDropdown = React.memo(({ label, placeholder, items, selectedKey, onSelect, C, s, disabled = false }: {
  label: string; placeholder: string; items: {key: string, label: string}[]; selectedKey: string | null; onSelect: (key: string) => void; C: any; s: any; disabled?: boolean;
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedItem = items.find(i => i.key === selectedKey);

  return (
    <View style={{ marginBottom: 12, opacity: disabled ? 0.6 : 1 }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity 
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
        activeOpacity={disabled ? 1 : 0.7}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: disabled ? C.bg : C.card, 
          borderWidth: 1, 
          borderColor: disabled ? C.border : (selectedKey ? C.accent : C.border),
          paddingHorizontal: 16, height: 50, borderRadius: 12
        }}
      >
        <Text style={{ color: selectedItem ? C.text : C.muted, fontWeight: selectedItem ? '700' : '500', fontSize: 14 }} numberOfLines={1}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ChevronDown size={18} color={selectedKey && !disabled ? C.accent : C.muted} />
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 16 }}>{placeholder}</Text>
            <FlatList
              data={items}
              keyExtractor={item => item.key}
              renderItem={({ item }) => {
                const isActive = item.key === selectedKey;
                return (
                  <TouchableOpacity
                    onPress={() => { onSelect(item.key); setModalVisible(false); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: 14, paddingHorizontal: 16,
                      backgroundColor: isActive ? C.accent + '15' : 'transparent',
                      borderRadius: 12, marginBottom: 4
                    }}
                  >
                    <Text style={{ color: isActive ? C.accent : C.text, fontWeight: isActive ? '700' : '500', fontSize: 15 }}>{item.label}</Text>
                    {isActive && <Check size={18} color={C.accent} />}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
});

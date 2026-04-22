import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Linking, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookOpen, ShieldCheck, Heart, MapPin, Phone, Mail, ChevronRight, GraduationCap } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const LazyImage = ({ source, style, C }: { source: any, style: any, C: any }) => {
  const [loading, setLoading] = React.useState(true);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.8, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [loading]);

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: C.card }]}>
      {loading && (
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: C.muted, opacity: pulseAnim, zIndex: 10 }} />
      )}
      <Image 
        source={source} 
        style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: loading ? 0 : 1 }} 
        onLoadEnd={() => setLoading(false)}
      />
    </View>
  );
};

export const SchoolInfoTab = React.memo(({ C, s }: { C: any, s: any }) => {
  const { t } = useTranslation();

  const features = [
    {
      icon: <BookOpen size={24} color={C.accent} />,
      title: t('school.spiritualGrowth', 'Spiritual Growth'),
      desc: t('school.spiritualDesc', 'Deepening the connection with Orthodox Tewahedo teachings and heritage.')
    },
    {
      icon: <GraduationCap size={24} color={C.green} />,
      title: t('school.academicExcellence', 'Academic Excellence'),
      desc: t('school.academicDesc', 'Providing a balanced curriculum that fosters both worldly and spiritual wisdom.')
    },
    {
      icon: <ShieldCheck size={24} color={C.amber} />,
      title: t('school.characterBuilding', 'Character Building'),
      desc: t('school.characterDesc', 'Instilling values of integrity, respect, and community service in every student.')
    }
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.heroContainer}>
        <LazyImage 
          source={require('../assets/branding/hero.png')} 
          style={styles.heroImage}
          C={C}
        />
        <View style={styles.heroOverlay}>
          <View style={styles.logoBadge}>
            <Image source={require('../assets/logo.png')} style={styles.smallLogo} />
          </View>
          <Text style={styles.heroTitle}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Text>
          <Text style={styles.heroMotto}>{t('school.motto', 'Wisdom, Faith, and Service')}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* About Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>{t('school.aboutUs', 'About Our School')}</Text>
          <View style={[styles.titleUnderline, { backgroundColor: C.accent }]} />
        </View>
        <Text style={[styles.description, { color: C.muted }]}>
            {t('school.mainDesc', 'Our school is dedicated to nurturing student success through a rich blend of traditional spiritual education and modern academic standards. We believe in creating a supportive community where every child can grow in faith and knowledge.')}
        </Text>

        {/* Features Row */}
        <View style={styles.featuresGrid}>
           {features.map((f, i) => (
             <View key={i} style={[styles.featureCard, { backgroundColor: C.card, borderColor: C.border }]}>
               <View style={styles.featureIcon}>{f.icon}</View>
               <Text style={[styles.featureTitle, { color: C.text }]}>{f.title}</Text>
               <Text style={[styles.featureDesc, { color: C.muted }]}>{f.desc}</Text>
             </View>
           ))}
        </View>

        {/* Heritage Section */}
        <View style={[styles.imageSection, { backgroundColor: C.card, borderColor: C.border }]}>
            <LazyImage source={require('../assets/branding/heritage.png')} style={styles.sectionImage} C={C} />
            <View style={styles.imageContent}>
                <Text style={[styles.imageTitle, { color: C.text }]}>{t('school.spiritualHeritage', 'Rich Spiritual Heritage')}</Text>
                <Text style={[styles.imageDesc, { color: C.muted }]}>
                    {t('school.heritageDesc', 'Preserving ancient wisdom for future generations through dedicated Ge’ez and liturgical studies.')}
                </Text>
            </View>
        </View>

        {/* Academic Section */}
        <View style={[styles.imageSection, { backgroundColor: C.card, borderColor: C.border, marginTop: 20 }]}>
            <LazyImage source={require('../assets/branding/students.png')} style={styles.sectionImage} C={C} />
            <View style={styles.imageContent}>
                <Text style={[styles.imageTitle, { color: C.text }]}>{t('school.modernLearning', 'Standardized Learning')}</Text>
                <Text style={[styles.imageDesc, { color: C.muted }]}>
                    {t('school.learningDesc', 'Combining traditional values with modern educational tools to ensure student success in all fields.')}
                </Text>
            </View>
        </View>

        {/* Contact info */}
        <View style={[styles.contactCard, { backgroundColor: C.accent }]}>
            <Text style={styles.contactTitle}>{t('school.visitUs', 'Get in Touch')}</Text>
            <View style={styles.contactRow}>
                <MapPin size={20} color="#fff" />
                <Text style={styles.contactText}>Addis Ababa, Ethiopia</Text>
            </View>
            <View style={styles.contactRow}>
                <Phone size={20} color="#fff" />
                <Text style={styles.contactText}>+251 912 345 678</Text>
            </View>
            <View style={styles.contactRow}>
                <Mail size={20} color="#fff" />
                <Text style={styles.contactText}>info@senbetschool.com</Text>
            </View>
            
            <TouchableOpacity 
                style={styles.ctaButton}
                onPress={() => Linking.openURL('tel:+251912345678')}
            >
                <Text style={[styles.ctaText, { color: C.accent }]}>{t('school.callNow', 'Call Office')}</Text>
                <ChevronRight size={18} color={C.accent} />
            </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  heroContainer: {
    width: width,
    height: 320,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  smallLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMotto: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  content: {
    padding: 20,
    marginTop: -30,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  titleUnderline: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  featuresGrid: {
    gap: 16,
    marginBottom: 32,
  },
  featureCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  imageSection: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  sectionImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imageContent: {
    padding: 20,
  },
  imageTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  imageDesc: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  contactCard: {
    marginTop: 32,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  contactTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  contactText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ctaButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    marginTop: 12,
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
  }
});

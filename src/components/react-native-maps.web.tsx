/**
 * react-native-maps Web Fallback
 * Provides safe web/SSR mock components for react-native-maps to prevent
 * codegenNativeComponent crashes on react-native-web.
 */

import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';

export interface MapViewProps extends ViewProps {
  initialRegion?: any;
  region?: any;
  onPress?: (event: any) => void;
  children?: React.ReactNode;
}

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

export const Marker: React.FC<any> = ({ children }) => {
  return children ? <View>{children}</View> : null;
};

export const Polyline: React.FC<any> = () => null;
export const Callout: React.FC<any> = ({ children }) => (children ? <View>{children}</View> : null);
export const Circle: React.FC<any> = () => null;
export const Polygon: React.FC<any> = () => null;

export const MapView: React.FC<MapViewProps> = ({ style, children }) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>🗺️ Interactive Map (Available on mobile devices)</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
});

export default MapView;

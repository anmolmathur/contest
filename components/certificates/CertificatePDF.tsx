import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { CertificatePDFProps } from "./types";

// A4 Landscape: 842 x 595 points
const createStyles = (primaryColor: string, secondaryColor: string) =>
  StyleSheet.create({
    page: {
      width: "100%",
      height: "100%",
      backgroundColor: "#ffffff",
      position: "relative",
    },
    // Outer decorative border
    outerBorder: {
      position: "absolute",
      top: 15,
      left: 15,
      right: 15,
      bottom: 15,
      borderWidth: 4,
      borderColor: primaryColor,
      borderStyle: "solid",
    },
    // Middle decorative border
    middleBorder: {
      position: "absolute",
      top: 22,
      left: 22,
      right: 22,
      bottom: 22,
      borderWidth: 1,
      borderColor: "#cccccc",
      borderStyle: "solid",
    },
    // Inner decorative border
    innerBorder: {
      position: "absolute",
      top: 28,
      left: 28,
      right: 28,
      bottom: 28,
      borderWidth: 2,
      borderColor: secondaryColor,
      borderStyle: "solid",
    },
    // Corner decorations
    cornerDecor: {
      position: "absolute",
      width: 30,
      height: 30,
    },
    topLeft: {
      top: 32,
      left: 32,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderTopColor: primaryColor,
      borderLeftColor: primaryColor,
    },
    topRight: {
      top: 32,
      right: 32,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderTopColor: primaryColor,
      borderRightColor: primaryColor,
    },
    bottomLeft: {
      bottom: 32,
      left: 32,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderBottomColor: primaryColor,
      borderLeftColor: primaryColor,
    },
    bottomRight: {
      bottom: 32,
      right: 32,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderBottomColor: primaryColor,
      borderRightColor: primaryColor,
    },
    // Main content container
    content: {
      position: "absolute",
      top: 40,
      left: 40,
      right: 40,
      bottom: 40,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
    },
    // Logo section
    logoContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      paddingHorizontal: 20,
    },
    logo: {
      width: 80,
      height: 50,
      objectFit: "contain",
    },
    logoPlaceholder: {
      width: 80,
      height: 50,
    },
    // Center content
    centerContent: {
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      width: "100%",
    },
    // Title
    title: {
      fontSize: 28,
      fontFamily: "Helvetica-Bold",
      color: primaryColor,
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: 4,
      marginBottom: 6,
    },
    // Decorative line under title
    decorativeLine: {
      width: 250,
      height: 3,
      backgroundColor: secondaryColor,
      marginVertical: 8,
    },
    // Subtitle
    subtitle: {
      fontSize: 12,
      fontFamily: "Helvetica",
      color: "#666666",
      textAlign: "center",
      marginBottom: 12,
    },
    // Member name - the main highlight
    memberName: {
      fontSize: 32,
      fontFamily: "Helvetica-Bold",
      color: "#1a1a1a",
      textAlign: "center",
      marginBottom: 8,
      paddingBottom: 6,
      paddingHorizontal: 30,
      borderBottomWidth: 2,
      borderBottomColor: primaryColor,
      borderBottomStyle: "solid",
    },
    // Team info row
    teamInfoContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 8,
      gap: 30,
    },
    teamInfo: {
      fontSize: 13,
      fontFamily: "Helvetica",
      color: "#444444",
      textAlign: "center",
    },
    teamName: {
      fontFamily: "Helvetica-Bold",
      color: secondaryColor,
    },
    // Rank badge
    rankContainer: {
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 35,
      backgroundColor: primaryColor,
      borderRadius: 4,
    },
    rankText: {
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      color: "#ffffff",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    // Event name
    eventName: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      color: "#333333",
      textAlign: "center",
      marginTop: 12,
    },
    // Footer text
    footerText: {
      fontSize: 10,
      fontFamily: "Helvetica-Oblique",
      color: "#777777",
      textAlign: "center",
      marginTop: 8,
      maxWidth: 450,
    },
    // Footer section
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      width: "100%",
      paddingHorizontal: 30,
    },
    dateSection: {
      alignItems: "flex-start",
    },
    dateLabel: {
      fontSize: 9,
      fontFamily: "Helvetica",
      color: "#888888",
      marginBottom: 2,
    },
    dateValue: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: "#333333",
    },
    signatureSection: {
      alignItems: "center",
    },
    signatureLine: {
      width: 140,
      height: 1,
      backgroundColor: "#333333",
      marginBottom: 4,
    },
    signatureName: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: "#333333",
      textAlign: "center",
    },
    signatureTitle: {
      fontSize: 9,
      fontFamily: "Helvetica",
      color: "#666666",
      textAlign: "center",
    },
    // Decorative elements
    topDecorLine: {
      position: "absolute",
      top: 10,
      left: "35%",
      right: "35%",
      height: 3,
      backgroundColor: secondaryColor,
    },
    bottomDecorLine: {
      position: "absolute",
      bottom: 10,
      left: "35%",
      right: "35%",
      height: 3,
      backgroundColor: secondaryColor,
    },
  });

export const CertificateDocument = ({
  memberName,
  teamName,
  track,
  rank,
  rankLabel,
  template,
}: CertificatePDFProps) => {
  const styles = createStyles(template.primaryColor, template.secondaryColor);
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Decorative borders */}
        <View style={styles.outerBorder} />
        <View style={styles.middleBorder} />
        <View style={styles.innerBorder} />

        {/* Corner decorations */}
        <View style={[styles.cornerDecor, styles.topLeft]} />
        <View style={[styles.cornerDecor, styles.topRight]} />
        <View style={[styles.cornerDecor, styles.bottomLeft]} />
        <View style={[styles.cornerDecor, styles.bottomRight]} />

        {/* Decorative lines at top and bottom */}
        <View style={styles.topDecorLine} />
        <View style={styles.bottomDecorLine} />

        {/* Main content */}
        <View style={styles.content}>
          {/* Logo section */}
          <View style={styles.logoContainer}>
            {template.primaryLogoUrl ? (
              <Image src={template.primaryLogoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
            {template.secondaryLogoUrl ? (
              <Image src={template.secondaryLogoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
          </View>

          {/* Center content */}
          <View style={styles.centerContent}>
            <Text style={styles.title}>{template.titleText}</Text>
            <View style={styles.decorativeLine} />
            <Text style={styles.subtitle}>{template.subtitleText}</Text>

            <Text style={styles.memberName}>{memberName}</Text>

            <View style={styles.teamInfoContainer}>
              <Text style={styles.teamInfo}>
                Team: <Text style={styles.teamName}>{teamName}</Text>
              </Text>
              <Text style={styles.teamInfo}>Track: {track}</Text>
            </View>

            <View style={styles.rankContainer}>
              <Text style={styles.rankText}>{rankLabel}</Text>
            </View>

            <Text style={styles.eventName}>{template.eventName}</Text>

            {template.footerText && (
              <Text style={styles.footerText}>{template.footerText}</Text>
            )}
          </View>

          {/* Footer with date and signature */}
          <View style={styles.footer}>
            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>Date of Issue</Text>
              <Text style={styles.dateValue}>{currentDate}</Text>
            </View>

            {(template.signatureName || template.signatureTitle) && (
              <View style={styles.signatureSection}>
                <View style={styles.signatureLine} />
                {template.signatureName && (
                  <Text style={styles.signatureName}>
                    {template.signatureName}
                  </Text>
                )}
                {template.signatureTitle && (
                  <Text style={styles.signatureTitle}>
                    {template.signatureTitle}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default CertificateDocument;

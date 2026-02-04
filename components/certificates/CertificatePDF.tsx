import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
  Circle,
  Font,
} from "@react-pdf/renderer";
import { CertificatePDFProps } from "./types";

// Register cursive font (Dancing Script - elegant cursive similar to Lucida Handwriting)
Font.register({
  family: "DancingScript",
  src: "https://cdn.jsdelivr.net/fontsource/fonts/dancing-script@latest/latin-700-normal.ttf",
});

// Colors
const NAVY_BLUE = "#1e3a5f";
const GOLD = "#c9a962";
const PRIMARY_COLOR = "#7c3aed"; // Purple accent
const TEAL = "#0d9488"; // Teal for team/track values
const MEDAL_GOLD = "#FFD700";
const MEDAL_SILVER = "#C0C0C0";
const MEDAL_BRONZE = "#CD7F32";

const styles = StyleSheet.create({
  page: {
    width: "100%",
    height: "100%",
    backgroundColor: NAVY_BLUE,
    padding: 12,
    position: "relative",
  },
  // Main white content area
  innerContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    position: "relative",
    overflow: "hidden",
  },
  // Gold diagonal corners
  cornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 80,
    height: 80,
  },
  cornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 80,
    height: 80,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 80,
    height: 80,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 80,
    height: 80,
  },
  // Content area
  content: {
    flex: 1,
    paddingHorizontal: 80,
    paddingTop: 30,
    paddingBottom: 25,
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Logo section
  logoSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  // Decorative line
  decorativeLine: {
    width: 150,
    height: 2,
    backgroundColor: GOLD,
    marginVertical: 6,
  },
  // Title section
  titleSection: {
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontFamily: "Helvetica-Bold",
    color: NAVY_BLUE,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Helvetica",
    color: "#666666",
    letterSpacing: 2,
    marginTop: 8,
    textTransform: "uppercase",
  },
  // Name section
  nameSection: {
    alignItems: "center",
    marginVertical: 12,
    width: "100%",
  },
  recipientName: {
    fontSize: 48,
    fontFamily: "DancingScript",
    color: NAVY_BLUE,
    textAlign: "center",
  },
  nameLine: {
    width: 400,
    height: 1,
    backgroundColor: GOLD,
    marginTop: 8,
  },
  // Rank badge section
  rankBadgeSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  medalContainer: {
    marginRight: 10,
  },
  rankBadge: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 4,
  },
  rankBadgeText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  // Event name section
  eventSection: {
    alignItems: "center",
    marginVertical: 6,
  },
  eventName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY_BLUE,
    textAlign: "center",
    letterSpacing: 1,
  },
  // Team/Track section
  teamTrackSection: {
    alignItems: "center",
    marginVertical: 8,
  },
  teamTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  teamTrackLabel: {
    fontSize: 13,
    fontFamily: "Helvetica",
    color: "#555555",
  },
  teamTrackValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
  },
  teamTrackSeparator: {
    fontSize: 13,
    fontFamily: "Helvetica",
    color: "#999999",
    marginHorizontal: 12,
  },
  // Description section
  descriptionSection: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 60,
  },
  description: {
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#444444",
    textAlign: "center",
    lineHeight: 1.5,
  },
  // Footer section
  footerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    width: "100%",
    marginTop: 15,
    paddingHorizontal: 40,
  },
  signatureSection: {
    alignItems: "center",
    width: 180,
  },
  signatureLine: {
    width: 140,
    height: 1,
    backgroundColor: "#333333",
    marginBottom: 5,
  },
  signatureLabel: {
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  signatureName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#333333",
    marginBottom: 3,
  },
  // Date section
  dateSection: {
    alignItems: "center",
    width: 180,
  },
  dateValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#333333",
    marginBottom: 5,
  },
  dateLabel: {
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

// Gold corner triangle SVG
const GoldCorner = ({ rotation = 0 }: { rotation?: number }) => (
  <Svg width="80" height="80" viewBox="0 0 80 80">
    <Path
      d={rotation === 0 ? "M0,0 L80,0 L0,80 Z" :
         rotation === 90 ? "M80,0 L80,80 L0,0 Z" :
         rotation === 180 ? "M80,80 L0,80 L80,0 Z" :
         "M0,80 L0,0 L80,80 Z"}
      fill={GOLD}
    />
  </Svg>
);

// Medal SVG component
const Medal = ({ rank }: { rank: number }) => {
  // Determine medal color based on rank
  const getMedalColor = () => {
    if (rank === 1) return MEDAL_GOLD;
    if (rank === 2) return MEDAL_SILVER;
    if (rank === 3) return MEDAL_BRONZE;
    return PRIMARY_COLOR; // For 4th, 5th place etc.
  };

  const medalColor = getMedalColor();
  const ribbonColor = rank <= 3 ? "#dc2626" : "#6366f1"; // Red for top 3, purple for others

  return (
    <Svg width="40" height="50" viewBox="0 0 40 50">
      {/* Ribbon */}
      <Path d="M12,0 L20,18 L28,0 L24,0 L20,10 L16,0 Z" fill={ribbonColor} />
      {/* Medal outer circle */}
      <Circle cx="20" cy="30" r="16" fill={medalColor} />
      {/* Medal inner circle */}
      <Circle cx="20" cy="30" r="12" fill="none" stroke="#ffffff" strokeWidth="1.5" />
      {/* Star in center */}
      <Path
        d="M20,22 L21.5,27 L27,27 L22.5,30.5 L24,36 L20,33 L16,36 L17.5,30.5 L13,27 L18.5,27 Z"
        fill="#ffffff"
      />
    </Svg>
  );
};

export const CertificateDocument = ({
  memberName,
  teamName,
  track,
  rank,
  rankLabel,
  template,
}: CertificatePDFProps) => {
  // Format date with superscript-style suffix
  const formatDateWithSuffix = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    const suffix = day === 1 || day === 21 || day === 31 ? "st" :
                   day === 2 || day === 22 ? "nd" :
                   day === 3 || day === 23 ? "rd" : "th";
    return `${day}${suffix} ${month}, ${year}`;
  };

  const formattedDate = formatDateWithSuffix(new Date());

  // Build description text
  const description = template.footerText ||
    `For outstanding performance and exceptional contribution in the ${template.eventName}. ` +
    `This achievement reflects dedication to innovation and excellence in AI-powered development.`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Inner white container */}
        <View style={styles.innerContainer}>
          {/* Gold corner decorations */}
          <View style={styles.cornerTopLeft}>
            <GoldCorner rotation={0} />
          </View>
          <View style={styles.cornerTopRight}>
            <GoldCorner rotation={90} />
          </View>
          <View style={styles.cornerBottomLeft}>
            <GoldCorner rotation={270} />
          </View>
          <View style={styles.cornerBottomRight}>
            <GoldCorner rotation={180} />
          </View>

          {/* Main content */}
          <View style={styles.content}>
            {/* Logo section */}
            <View style={styles.logoSection}>
              {template.primaryLogoUrl ? (
                <Image
                  src={template.primaryLogoUrl}
                  style={{ width: 180, height: 60, objectFit: "contain" }}
                />
              ) : (
                <View style={styles.decorativeLine} />
              )}
            </View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>{template.titleText}</Text>
              <Text style={styles.subtitle}>{template.subtitleText}</Text>
            </View>

            {/* Recipient name */}
            <View style={styles.nameSection}>
              <Text style={styles.recipientName}>{memberName}</Text>
              <View style={styles.nameLine} />
            </View>

            {/* Rank Badge with Medal */}
            <View style={styles.rankBadgeSection}>
              <View style={styles.medalContainer}>
                <Medal rank={rank} />
              </View>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{rankLabel}</Text>
              </View>
            </View>

            {/* Event Name */}
            <View style={styles.eventSection}>
              <Text style={styles.eventName}>{template.eventName}</Text>
            </View>

            {/* Team and Track */}
            <View style={styles.teamTrackSection}>
              <View style={styles.teamTrackRow}>
                <Text style={styles.teamTrackLabel}>Team: </Text>
                <Text style={styles.teamTrackValue}>{teamName}</Text>
                <Text style={styles.teamTrackSeparator}>|</Text>
                <Text style={styles.teamTrackLabel}>Track: </Text>
                <Text style={styles.teamTrackValue}>{track}</Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.descriptionSection}>
              <Text style={styles.description}>{description}</Text>
            </View>

            {/* Footer with signature and date */}
            <View style={styles.footerSection}>
              {/* Signature */}
              <View style={styles.signatureSection}>
                {template.signatureName && (
                  <Text style={styles.signatureName}>{template.signatureName}</Text>
                )}
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Authorized Signature</Text>
              </View>

              {/* Date */}
              <View style={styles.dateSection}>
                <Text style={styles.dateValue}>{formattedDate}</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.dateLabel}>Date of Issue</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default CertificateDocument;

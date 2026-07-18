import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { assistantHome, demoRequest, type MobilePublishedSnapshot } from "@leaseflow/demo-data";
import { fetchPublishedData } from "../src/data/published-data";

export default function Home() {
  const [published, setPublished] = useState<MobilePublishedSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reloadPublished() {
    try {
      setPublished(await fetchPublishedData());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Published data unavailable.");
    }
  }

  useEffect(() => { void reloadPublished(); }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.brand}>LeaseFlow Copilot</Text><Text style={styles.badge}>DEMO · LM Manager</Text></View>
      <Text style={styles.eyebrow}>AI OPERATIONS ASSISTANT</Text>
      <Text style={styles.title}>Good afternoon, James.</Text>
      <Text style={styles.subtitle}>Published leasing data is ready for one request and one weekly landlord report.</Text>
      <View style={styles.metrics}>
        <Metric number={assistantHome.pendingPackages} label="Package to review" />
        <Metric number={assistantHome.weeklyReportsDue} label="Weekly report due" />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>RECENT CALL</Text>
        <Text style={styles.cardTitle}>Cobalt Finance Center · 5F</Text>
        <Text style={styles.body}>{demoRequest.text}</Text>
        <View style={styles.warning}><Text style={styles.warningText}>Guardrail: use only the current published area and plan.</Text></View>
        {published && <View style={styles.snapshot}>
          <Text style={styles.snapshotValue}>{published.marketed_area_py} py · {published.rent_free_months} months RF · {published.supported_parking_spaces} parking</Text>
          <Text style={styles.snapshotPlan}>Current: {published.floor_plan.filename}</Text>
          <Text style={styles.blocked}>Blocked: {published.blocked_floor_plans.join(", ") || "none"}</Text>
        </View>}
        {loadError && <Text style={styles.loadError}>{loadError} Start Admin Web or set EXPO_PUBLIC_LEASEFLOW_API_URL.</Text>}
        <TouchableOpacity style={styles.primary} onPress={() => void reloadPublished()}><Text style={styles.primaryText}>Reload published data</Text></TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>WEEKLY REPORT</Text>
        <Text style={styles.cardTitle}>Cobalt Finance Center</Text>
        <Text style={styles.body}>LeaseFlow activity + mock Outlook are ready for external landlord reporting.</Text>
        <TouchableOpacity style={styles.secondary}><Text style={styles.secondaryText}>Run report now</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Metric({number,label}:{number:number;label:string}){
  return <View style={styles.metric}><Text style={styles.metricNumber}>{number}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f4f7f5"}, content:{padding:22,paddingTop:48,paddingBottom:64,maxWidth:560,width:"100%",alignSelf:"center"},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:36}, brand:{fontSize:20,fontWeight:"800",color:"#0f172a"}, badge:{fontSize:11,fontWeight:"800",color:"#0f766e",backgroundColor:"#ecfdf5",paddingHorizontal:9,paddingVertical:6,borderRadius:999},
  eyebrow:{fontSize:12,fontWeight:"800",color:"#0f766e",letterSpacing:1.2}, title:{fontSize:36,lineHeight:40,fontWeight:"900",color:"#0f172a",marginTop:8}, subtitle:{fontSize:16,lineHeight:24,color:"#64748b",marginTop:10},
  metrics:{flexDirection:"row",gap:12,marginTop:24}, metric:{flex:1,backgroundColor:"#0f172a",borderRadius:18,padding:18}, metricNumber:{fontSize:34,fontWeight:"900",color:"#bef264"}, metricLabel:{fontSize:12,color:"#e2e8f0",marginTop:4},
  card:{backgroundColor:"white",borderColor:"#dbe5df",borderWidth:1,borderRadius:20,padding:20,marginTop:16}, cardLabel:{fontSize:11,fontWeight:"800",color:"#0f766e",letterSpacing:1}, cardTitle:{fontSize:22,fontWeight:"900",color:"#0f172a",marginTop:8}, body:{fontSize:15,lineHeight:22,color:"#475569",marginTop:10},
  warning:{backgroundColor:"#fff7ed",padding:12,borderRadius:12,marginTop:14}, warningText:{fontSize:13,fontWeight:"700",color:"#9a3412"},
  snapshot:{backgroundColor:"#ecfdf5",padding:13,borderRadius:12,marginTop:12}, snapshotValue:{fontSize:14,fontWeight:"900",color:"#065f46"}, snapshotPlan:{fontSize:13,color:"#0f766e",marginTop:5}, blocked:{fontSize:12,color:"#9a3412",marginTop:5}, loadError:{fontSize:12,color:"#991b1b",marginTop:12},
  primary:{backgroundColor:"#0f766e",padding:14,borderRadius:13,alignItems:"center",marginTop:16}, primaryText:{fontSize:15,fontWeight:"900",color:"white"},
  secondary:{backgroundColor:"#eaf1ed",padding:14,borderRadius:13,alignItems:"center",marginTop:16}, secondaryText:{fontSize:15,fontWeight:"900",color:"#0f172a"}
});

import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class TripsListScreen extends StatefulWidget {
  const TripsListScreen({Key? key}) : super(key: key);

  @override
  State<TripsListScreen> createState() => _TripsListScreenState();
}

class _TripsListScreenState extends State<TripsListScreen> {
  final List<Map<String, dynamic>> _allTrips = [];

  List<Map<String, dynamic>> _displayedTrips = [];
  final TextEditingController _searchController = TextEditingController();
  bool _isSortedByTime = true;

  @override
  void initState() {
    super.initState();
    _displayedTrips = List.from(_allTrips);
    _loadTrips();
    ApiService.instance.addListener(_loadTrips);
  }

  @override
  void dispose() {
    _searchController.dispose();
    ApiService.instance.removeListener(_loadTrips);
    super.dispose();
  }

  Future<void> _loadTrips() async {try{final trips=await ApiService.instance.trips();if(!mounted)return;setState((){_allTrips..clear()..addAll(trips.map((t)=>{"id":t['id'],"vessel":t['vesselName'],"owner":t['ownerName'],"reg":t['registrationNumber'],"time":DateTime.parse(t['scheduledDepartureUtc']).toLocal().toString(),"status":t['shoreApproval'],"color":t['shoreApproval']=='Approved'?Colors.green:t['shoreApproval']=='Rejected'?Colors.red:Colors.black87}));_displayedTrips=List.from(_allTrips);});}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}}

  void _runSearch(String enteredKeyword) {
    List<Map<String, dynamic>> results = [];
    if (enteredKeyword.isEmpty) {
      results = List.from(_allTrips);
    } else {
      results = _allTrips.where((trip) => 
        trip["vessel"].toLowerCase().contains(enteredKeyword.toLowerCase()) ||
        trip["reg"].toLowerCase().contains(enteredKeyword.toLowerCase())
      ).toList();
    }
    setState(() {
      _displayedTrips = results;
    });
  }

  void _deleteTrip(String regNo) {
    setState(() {
      _allTrips.removeWhere((trip) => trip["reg"] == regNo);
      _displayedTrips.removeWhere((trip) => trip["reg"] == regNo);
    });
  }

  void _toggleSort() {
    setState(() {
      _isSortedByTime = !_isSortedByTime;
      if (_isSortedByTime) {
        _displayedTrips.sort((a, b) => a["time"].compareTo(b["time"]));
      } else {
        _displayedTrips.sort((a, b) => a["vessel"].compareTo(b["vessel"]));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData.light().copyWith(
        scaffoldBackgroundColor: const Color(0xFFEBECEF), 
        primaryColor: const Color(0xFF152238),
      ),
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Image.asset('assets/images/slcg_logo.png', height: 50, errorBuilder: (c,e,s) => const Icon(Icons.anchor)),
                    Row(
                      children: [
                        const Icon(Icons.notifications_none, color: Color(0xFF152238)),
                        const SizedBox(width: 24),
                        GestureDetector(
                          onTap: () => Navigator.pushReplacementNamed(context, '/shore_dashboard'),
                          child: const Text("Home", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
                        ),
                        const SizedBox(width: 24),
                        const Text("Settings", style: TextStyle(color: Color(0xFF152238), fontWeight: FontWeight.w500)),
                        const SizedBox(width: 24),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF152238), foregroundColor: Colors.white),
                          onPressed: () => Navigator.pushReplacementNamed(context, '/'),
                          child: const Text("Log Out"),
                        )
                      ],
                    )
                  ],
                ),
                const SizedBox(height: 32),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text("Scheduled Trips", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF152238))),
                            Row(
                              children: [
                                SizedBox(
                                  width: 200,
                                  height: 40,
                                  child: TextField(
                                    controller: _searchController,
                                    onChanged: _runSearch,
                                    decoration: InputDecoration(
                                      hintText: "Search vessel...",
                                      hintStyle: const TextStyle(color: Colors.grey, fontSize: 14),
                                      prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 20),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                GestureDetector(
                                  onTap: _toggleSort,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
                                    child: Row(
                                      children: [
                                        Text(_isSortedByTime ? "Sort by : Time" : "Sort by : Name", style: const TextStyle(color: Color(0xFF152238), fontSize: 12)),
                                        const SizedBox(width: 8),
                                        const Icon(Icons.keyboard_arrow_down, size: 16, color: Color(0xFF152238))
                                      ],
                                    ),
                                  ),
                                )
                              ],
                            )
                          ],
                        ),
                        const SizedBox(height: 24),
                        Expanded(
                          child: SingleChildScrollView(
                            scrollDirection: Axis.vertical,
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: _displayedTrips.isEmpty 
                                ? const Padding(padding: EdgeInsets.all(32.0), child: Text("No trips found.", style: TextStyle(color: Colors.grey)))
                                : DataTable(
                                    headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF152238)),
                                    columnSpacing: 48, 
                                    columns: const [
                                      DataColumn(label: Text('Vessel')),
                                      DataColumn(label: Text('Owner')),
                                      DataColumn(label: Text('Registration no')),
                                      DataColumn(label: Text('Scheduled Time')),
                                      DataColumn(label: Text('Approval')),
                                      DataColumn(label: Text('')), 
                                    ],
                                    rows: _displayedTrips.map((trip) {
                                      return DataRow(
                                        cells: [
                                          DataCell(Text(trip["vessel"], maxLines: 1, style: const TextStyle(color: Color(0xFF152238)))),
                                          DataCell(Text(trip["owner"], maxLines: 1, style: const TextStyle(color: Color(0xFF152238)))),
                                          DataCell(Text(trip["reg"], maxLines: 1, style: const TextStyle(color: Color(0xFF152238)))),
                                          DataCell(Text(trip["time"], maxLines: 1, style: const TextStyle(color: Color(0xFF152238)))),
                                          DataCell(Text(trip["status"], maxLines: 1, style: TextStyle(color: trip["color"], fontWeight: FontWeight.w500))),
                                          DataCell(
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                IconButton(icon: const Icon(Icons.info_outline, color: Color(0xFF152238)), onPressed: () => Navigator.pushNamed(context, '/vessel_details', arguments: trip)),
                                                IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => _deleteTrip(trip["reg"])),
                                              ],
                                            ),
                                          ),
                                        ],
                                      );
                                    }).toList(),
                                  ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

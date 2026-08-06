import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../services/api_service.dart';

const _navy = Color(0xFF162D54);
const _ink = Color(0xFF14223D);
const _canvas = Color(0xFFF8F9FB);

class CrewShell extends StatelessWidget {
  const CrewShell({super.key, required this.child, this.title});
  final Widget child;
  final String? title;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _canvas,
        appBar: AppBar(
          leading: IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () =>
                Navigator.pushNamed(context, '/crew_notifications'),
          ),
          title: title == null
              ? null
              : Text(title!,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w700)),
          actions: [
            Builder(
                builder: (context) => IconButton(
                      tooltip: 'Menu',
                      icon: const Icon(Icons.menu_rounded, size: 28),
                      onPressed: () => Scaffold.of(context).openEndDrawer(),
                    ))
          ],
        ),
        endDrawer: const CrewDrawer(),
        body: SafeArea(child: child),
      );
}

class CrewDrawer extends StatelessWidget {
  const CrewDrawer({super.key});
  static const items = [
    ('Dashboard', Icons.home_outlined, '/boat_crew'),
    ('Profile', Icons.person_outline_rounded, '/crew_profile'),
    ('My Trips', Icons.directions_boat_outlined, '/crew_trips'),
    ('Settings', Icons.settings_outlined, '/crew_settings'),
  ];
  @override
  Widget build(BuildContext context) => Drawer(
        width: 290,
        backgroundColor: Colors.white,
        child: SafeArea(
            child: Column(children: [
          Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context))),
          const Padding(
            padding: EdgeInsets.fromLTRB(24, 12, 24, 20),
            child: Row(children: [
              CircleAvatar(
                  backgroundColor: _navy,
                  child: Icon(Icons.sailing, color: Colors.white)),
              SizedBox(width: 12),
              Text('Boat Crew',
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800, color: _ink))
            ]),
          ),
          ...items.map((item) => ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 5),
                leading: Icon(item.$2, color: _ink),
                title: Text(item.$1,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.pushReplacementNamed(context, item.$3);
                },
              )),
        ])),
      );
}

class CrewStatus extends StatelessWidget {
  const CrewStatus(this.value, {super.key});
  final String value;
  @override
  Widget build(BuildContext context) {
    final approved = value == 'Approved' || value == 'Completed';
    final rejected = value == 'Rejected' || value == 'Cancelled';
    final color = approved
        ? const Color(0xFF059669)
        : rejected
            ? const Color(0xFFDC2626)
            : value == 'Ongoing'
                ? const Color(0xFF2563EB)
                : const Color(0xFFD97706);
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(radius: 3, backgroundColor: color),
          const SizedBox(width: 6),
          Text(value.toUpperCase(),
              style: TextStyle(
                  fontSize: 9, fontWeight: FontWeight.w700, color: color))
        ]));
  }
}

class BoatCrewDashboard extends StatefulWidget {
  const BoatCrewDashboard({super.key});
  @override
  State<BoatCrewDashboard> createState() => _BoatCrewDashboardState();
}

class _BoatCrewDashboardState extends State<BoatCrewDashboard> {
  bool loading = true;
  String? error;
  Map<String, dynamic>? profile;
  List<Map<String, dynamic>> trips = [];
  @override
  void initState() {
    super.initState();
    _load();
    ApiService.instance.addListener(_refresh);
  }

  @override
  void dispose() {
    ApiService.instance.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) _load();
  }

  Future<void> _load() async {
    try {
      final values = await Future.wait(
          [ApiService.instance.crewProfile(), ApiService.instance.trips()]);
      if (mounted)
        setState(() {
          profile = values[0] as Map<String, dynamic>;
          trips = values[1] as List<Map<String, dynamic>>;
          loading = false;
          error = null;
        });
    } catch (e) {
      if (mounted)
        setState(() {
          loading = false;
          error = _error(e);
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ongoing = trips.where((t) => t['status'] == 'Ongoing').firstOrNull;
    final upcoming = trips
        .where(
            (t) => !['Ongoing', 'Completed', 'Cancelled'].contains(t['status']))
        .toList();
    return CrewShell(
        child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
                children: [
                  if (loading)
                    const Padding(
                        padding: EdgeInsets.all(60),
                        child: Center(child: CircularProgressIndicator()))
                  else if (error != null)
                    _ErrorCard(error!, _load)
                  else ...[
                    Row(children: [
                      CircleAvatar(
                          radius: 27,
                          backgroundColor: const Color(0xFFEFF3F8),
                          child: Text(
                              (profile?['displayName']?.toString() ?? 'C')
                                  .characters
                                  .first,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, color: _navy))),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            const Text('Welcome Back',
                                style: TextStyle(
                                    fontSize: 10, color: Colors.blueGrey)),
                            Text(
                                profile?['displayName']?.toString() ??
                                    'Crew Member',
                                style: const TextStyle(
                                    fontSize: 17, fontWeight: FontWeight.w700)),
                            CrewStatus(profile?['certified'] == true
                                ? 'Approved'
                                : 'Pending')
                          ]))
                    ]),
                    const SizedBox(height: 22),
                    ongoing == null ? _navyEmpty() : _ongoing(ongoing),
                    const Padding(
                        padding: EdgeInsets.only(top: 24, bottom: 12),
                        child: Text('Upcoming Trips',
                            style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: _ink))),
                    if (upcoming.isEmpty)
                      const _EmptyCard('No upcoming trips assigned.',
                          Icons.event_available_outlined)
                    else
                      ...upcoming.map(_tripCard)
                  ]
                ])));
  }

  Widget _navyEmpty() => Container(
      padding: const EdgeInsets.all(22),
      decoration:
          BoxDecoration(color: _navy, borderRadius: BorderRadius.circular(18)),
      child:
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.sailing, color: Colors.white),
        SizedBox(height: 20),
        Text('No ongoing trip',
            style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 17)),
        Text('Your active assignment will appear here.',
            style: TextStyle(color: Colors.white70, fontSize: 12))
      ]));
  Widget _ongoing(Map<String, dynamic> t) => InkWell(
      onTap: () => _open(t),
      borderRadius: BorderRadius.circular(18),
      child: Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
              gradient: const LinearGradient(
                  colors: [Color(0xFF075AEE), Color(0xFF12348C)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                    color: Colors.blue.withValues(alpha: .25),
                    blurRadius: 16,
                    offset: const Offset(0, 8))
              ]),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Ongoing Trip',
                      style: TextStyle(color: Colors.white, fontSize: 17)),
                  Icon(Icons.directions_boat, color: Colors.white)
                ]),
            const SizedBox(height: 28),
            Text(t['vesselName'] ?? 'Vessel',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700)),
            Text(t['registrationNumber'] ?? '',
                style: const TextStyle(color: Colors.white70, fontSize: 11)),
            const Align(
                alignment: Alignment.centerRight,
                child: Icon(Icons.info_outline, color: Colors.white))
          ])));
  Widget _tripCard(Map<String, dynamic> t) => Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: InkWell(
          onTap: () => _open(t),
          borderRadius: BorderRadius.circular(18),
          child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Container(
                    width: 74,
                    height: 74,
                    decoration: BoxDecoration(
                        color: const Color(0xFFEFF3F8),
                        borderRadius: BorderRadius.circular(14)),
                    child: const Icon(Icons.directions_boat_outlined,
                        color: _navy, size: 34)),
                const SizedBox(width: 14),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(t['vesselName'] ?? 'Vessel',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                      Text(_date(t['scheduledDepartureUtc']),
                          style: const TextStyle(
                              color: Colors.blueGrey, fontSize: 11)),
                      const SizedBox(height: 8),
                      CrewStatus(t['shoreApproval'] ?? 'Pending')
                    ])),
                const Icon(Icons.chevron_right_rounded)
              ]))));
  void _open(Map<String, dynamic> t) =>
      Navigator.pushNamed(context, '/crew_trip_info', arguments: t['id']);
}

class BoatCrewTripsScreen extends StatefulWidget {
  const BoatCrewTripsScreen({super.key});
  @override
  State<BoatCrewTripsScreen> createState() => _CrewTripsState();
}

class _CrewTripsState extends State<BoatCrewTripsScreen> {
  List<Map<String, dynamic>> trips = [];
  bool loading = true;
  String query = '';
  String sort = 'name';
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final value = await ApiService.instance.trips();
    if (mounted)
      setState(() {
        trips = value;
        loading = false;
      });
  }

  @override
  Widget build(BuildContext context) {
    final rows = trips
        .where((t) =>
            '${t['vesselName']} ${t['registrationNumber']} ${t['status']}'
                .toLowerCase()
                .contains(query.toLowerCase()))
        .toList()
      ..sort((a, b) => sort == 'time'
          ? DateTime.parse(a['scheduledDepartureUtc'])
              .compareTo(DateTime.parse(b['scheduledDepartureUtc']))
          : sort == 'status'
              ? '${a['status']}'.compareTo('${b['status']}')
              : '${a['vesselName']}'.compareTo('${b['vesselName']}'));
    return CrewShell(
        title: 'My Trips',
        child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(padding: const EdgeInsets.all(18), children: [
              const Text('My Trips',
                  style: TextStyle(
                      fontSize: 25, fontWeight: FontWeight.w800, color: _ink)),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(
                    child: TextField(
                        onChanged: (v) => setState(() => query = v),
                        decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.search),
                            hintText: 'Search'))),
                const SizedBox(width: 10),
                PopupMenuButton<String>(
                    icon: const Icon(Icons.sort_rounded),
                    onSelected: (v) => setState(() => sort = v),
                    itemBuilder: (_) => const [
                          PopupMenuItem(
                              value: 'name', child: Text('Sort by name')),
                          PopupMenuItem(
                              value: 'time', child: Text('Sort by time')),
                          PopupMenuItem(
                              value: 'status', child: Text('Sort by status'))
                        ])
              ]),
              const SizedBox(height: 18),
              if (loading)
                const Center(child: CircularProgressIndicator())
              else if (rows.isEmpty)
                const _EmptyCard(
                    'No trips match your search.', Icons.search_off_rounded)
              else
                ...rows.map((t) => _CrewTripCard(
                    trip: t,
                    onTap: () => Navigator.pushNamed(context, '/crew_trip_info',
                        arguments: t['id'])))
            ])));
  }
}

class _CrewTripCard extends StatelessWidget {
  const _CrewTripCard({required this.trip, required this.onTap});
  final Map<String, dynamic> trip;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            Row(children: [
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    const Text('Boat',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Text(trip['vesselName'] ?? ''),
                    const SizedBox(height: 9),
                    const Text('Schedule',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Text(_date(trip['scheduledDepartureUtc']),
                        style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 8),
                    CrewStatus(trip['shoreApproval'] ?? 'Pending')
                  ])),
              Container(
                  width: 120,
                  height: 112,
                  decoration: BoxDecoration(
                      color: const Color(0xFFEFF3F8),
                      borderRadius: BorderRadius.circular(13)),
                  child: const Icon(Icons.sailing, color: _navy, size: 46))
            ]),
            const SizedBox(height: 12),
            SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                    onPressed: onTap,
                    icon: const Icon(Icons.info_outline, size: 18),
                    label: const Text('Trip Information')))
          ])));
}

/*
class BoatCrewTripDetailsScreen extends StatefulWidget{const BoatCrewTripDetailsScreen({super.key});@override State<BoatCrewTripDetailsScreen> createState()=>_CrewTripDetailsState();}
class _CrewTripDetailsState extends State<BoatCrewTripDetailsScreen>{Map<String,dynamic>? trip,attendance,vessel;List<Map<String,dynamic>> passengers=[];bool loading=true,sosBusy=false;String? error,id;@override void didChangeDependencies(){super.didChangeDependencies();id??=ModalRoute.of(context)?.settings.arguments as String?;if(loading)_load();}Future<void> _load()async{try{final all=await ApiService.instance.trips();final found=all.where((x)=>x['id']==id).firstOrNull;if(found==null)throw Exception('Trip not found.');final values=await Future.wait([ApiService.instance.tripPassengers(id!),ApiService.instance.crewAttendance(id!),ApiService.instance.vesselMap()]);if(mounted)setState((){trip=found;passengers=values[0] as List<Map<String,dynamic>>;attendance=values[1] as Map<String,dynamic>;final vessels=values[2] as List<Map<String,dynamic>>;vessel=vessels.where((x)=>x['id']==found['boatId']).firstOrNull;loading=false;error=null;});}catch(e){if(mounted)setState((){loading=false;error=_error(e);});}}@override Widget build(BuildContext context)=>CrewShell(title:'Trip Info',child:loading?const Center(child:CircularProgressIndicator()):error!=null?_ErrorCard(error!,_load):RefreshIndicator(onRefresh:_load,child:ListView(padding:const EdgeInsets.all(18),children:[_summary(),const SizedBox(height:16),_attendance(),const SizedBox(height:16),_passengers(),const SizedBox(height:16),_location(),const SizedBox(height:90)])));Widget _summary()=>Card(child:Padding(padding:const EdgeInsets.all(18),child:Column(children:[Row(crossAxisAlignment:CrossAxisAlignment.start,children:[Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(trip!['vesselName']??'',style:const TextStyle(fontSize:21,fontWeight:FontWeight.w800)),Text(trip!['registrationNumber']??'',style:const TextStyle(color:Colors.blueGrey)),const SizedBox(height:12),Text(_date(trip!['scheduledDepartureUtc'])),const SizedBox(height:8),CrewStatus(trip!['shoreApproval']??'Pending')])),if(trip!['invitationCode']!=null)QrImageView(data:trip!['invitationCode'],size:112)]),if(trip!['invitationCode']!=null)Align(alignment:Alignment.centerRight,child:TextButton.icon(onPressed:(){Clipboard.setData(ClipboardData(text:trip!['invitationCode']));},icon:const Icon(Icons.copy,size:16),label:const Text('Copy invitation code')))])));
  Widget _attendance(){final s=(attendance?['summary'] as Map?)?.cast<String,dynamic>()??{};return Card(child:Padding(padding:const EdgeInsets.all(18),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('Passenger Attendance',style:TextStyle(fontSize:18,fontWeight:FontWeight.w800)),const SizedBox(height:14),Row(children:[_metric('Present',s['present']??0,Colors.green),_metric('Absent',s['notPresent']??0,Colors.red),_metric('Not checked',s['notChecked']??0,Colors.orange)]),const SizedBox(height:14),LinearProgressIndicator(value:(s['total']??0)==0?0:(s['present']??0)/(s['total']??1),minHeight:8,borderRadius:BorderRadius.circular(10))])));}
  Widget _metric(String label,dynamic value,Color color)=>Expanded(child:Column(children:[Text('$value',style:TextStyle(fontSize:22,fontWeight:FontWeight.w800,color:color)),Text(label,style:const TextStyle(fontSize:10,color:Colors.blueGrey))]));
  Widget _passengers()=>Card(child:Padding(padding:const EdgeInsets.all(18),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[const Text('Passenger Info',style:TextStyle(fontSize:18,fontWeight:FontWeight.w800)),CrewStatus('${passengers.length} registered')]),const SizedBox(height:8),if(passengers.isEmpty)const Text('No passengers registered yet.',style:TextStyle(color:Colors.blueGrey))else ...passengers.map((p)=>ListTile(contentPadding:EdgeInsets.zero,leading:const CircleAvatar(child:Icon(Icons.person_outline)),title:Text(p['name']??''),subtitle:Text('${p['identificationNumber']??''} · ${p['passengerType']??''}')))])));
  Widget _location(){final lat=vessel?['latitude'],lng=vessel?['longitude'];return Card(child:Padding(padding:const EdgeInsets.all(18),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('Live vessel location',style:TextStyle(fontSize:18,fontWeight:FontWeight.w800)),const Text('Updates from the vessel GPS',style:TextStyle(fontSize:11,color:Colors.blueGrey)),const SizedBox(height:14),Container(height:150,width:double.infinity,decoration:BoxDecoration(color:const Color(0xFFE7EEF6),borderRadius:BorderRadius.circular(14)),child:Center(child:lat==null?const Text('No GPS location received yet.'):Column(mainAxisSize:MainAxisSize.min,children:[const Icon(Icons.location_on,color:Colors.red,size:42),Text('$lat, $lng')]))),const SizedBox(height:16),SizedBox(width:double.infinity,child:ElevatedButton.icon(style:ElevatedButton.styleFrom(backgroundColor:Colors.red),onPressed:sosBusy||trip!['hasActiveSos']==true?null:_sos,icon:const Icon(Icons.sos),label:Text(trip!['hasActiveSos']==true?'SOS ACTIVE':'SEND SOS ALERT')))])));
  Future<void> _sos()async{final confirm=await showDialog<bool>(context:context,builder:(d)=>AlertDialog(title:const Text('Send emergency SOS?'),content:Text('Request emergency assistance for ${trip!['vesselName']}.'),actions:[TextButton(onPressed:()=>Navigator.pop(d,false),child:const Text('Cancel')),ElevatedButton(onPressed:()=>Navigator.pop(d,true),child:const Text('Send SOS'))]))??false;if(!confirm)return;setState(()=>sosBusy=true);try{await ApiService.instance.raiseCrewSos(id!);await _load();}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(_error(e))));}finally{if(mounted)setState(()=>sosBusy=false);}}
}
*/

class BoatCrewTripDetailsScreen extends StatefulWidget {
  const BoatCrewTripDetailsScreen({super.key});
  @override
  State<BoatCrewTripDetailsScreen> createState() => _CrewDetailsState();
}

class _CrewDetailsState extends State<BoatCrewTripDetailsScreen> {
  String? id;
  Map<String, dynamic>? trip;
  Map<String, dynamic>? attendance;
  List<Map<String, dynamic>> passengers = [];
  bool loading = true;
  bool sosBusy = false;
  String? error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (id == null) {
      id = ModalRoute.of(context)?.settings.arguments as String?;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final trips = await ApiService.instance.trips();
      final selected = trips.where((item) => item['id'] == id).firstOrNull;
      if (selected == null) throw Exception('Trip not found.');
      final values = await Future.wait([
        ApiService.instance.tripPassengers(id!),
        ApiService.instance.crewAttendance(id!),
      ]);
      if (!mounted) return;
      setState(() {
        trip = selected;
        passengers = values[0] as List<Map<String, dynamic>>;
        attendance = values[1] as Map<String, dynamic>;
        loading = false;
        error = null;
      });
    } catch (exception) {
      if (mounted)
        setState(() {
          loading = false;
          error = _error(exception);
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading)
      return const CrewShell(
          title: 'Trip Info',
          child: Center(child: CircularProgressIndicator()));
    if (error != null)
      return CrewShell(title: 'Trip Info', child: _ErrorCard(error!, _load));
    final summary =
        (attendance?['summary'] as Map?)?.cast<String, dynamic>() ?? {};
    return CrewShell(
      title: 'Trip Info',
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(trip!['vesselName'] ?? '',
                                  style: const TextStyle(
                                      fontSize: 21,
                                      fontWeight: FontWeight.w800)),
                              Text(trip!['registrationNumber'] ?? '',
                                  style:
                                      const TextStyle(color: Colors.blueGrey)),
                              const SizedBox(height: 12),
                              Text(_date(trip!['scheduledDepartureUtc'])),
                              const SizedBox(height: 8),
                              CrewStatus(trip!['shoreApproval'] ?? 'Pending'),
                            ])),
                        if (trip!['invitationCode'] != null)
                          QrImageView(data: trip!['invitationCode'], size: 110),
                      ],
                    ))),
            const SizedBox(height: 16),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Passenger Attendance',
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 16),
                        Row(children: [
                          _count(
                              'Present', summary['present'] ?? 0, Colors.green),
                          _count(
                              'Absent', summary['notPresent'] ?? 0, Colors.red),
                          _count('Not checked', summary['notChecked'] ?? 0,
                              Colors.orange),
                        ]),
                      ],
                    ))),
            const SizedBox(height: 16),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Passenger Info · ${passengers.length}',
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w800)),
                        if (passengers.isEmpty)
                          const Padding(
                              padding: EdgeInsets.only(top: 14),
                              child: Text('No passengers registered yet.')),
                        ...passengers.map((person) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const CircleAvatar(
                                  child: Icon(Icons.person_outline)),
                              title: Text(person['name'] ?? ''),
                              subtitle: Text(
                                  '${person['identificationNumber'] ?? ''} · ${person['passengerType'] ?? ''}'),
                            )),
                      ],
                    ))),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  minimumSize: const Size.fromHeight(54)),
              onPressed:
                  sosBusy || trip!['hasActiveSos'] == true ? null : _sendSos,
              icon: const Icon(Icons.sos),
              label: Text(trip!['hasActiveSos'] == true
                  ? 'SOS ACTIVE'
                  : 'SEND SOS ALERT'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _count(String label, dynamic value, Color color) => Expanded(
          child: Column(children: [
        Text('$value',
            style: TextStyle(
                fontSize: 23, fontWeight: FontWeight.w800, color: color)),
        Text(label,
            style: const TextStyle(fontSize: 10, color: Colors.blueGrey)),
      ]));

  Future<void> _sendSos() async {
    setState(() => sosBusy = true);
    try {
      await ApiService.instance.raiseCrewSos(id!);
      await _load();
    } catch (exception) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_error(exception))));
    } finally {
      if (mounted) setState(() => sosBusy = false);
    }
  }
}

class BoatCrewProfileScreen extends StatefulWidget {
  const BoatCrewProfileScreen({super.key});
  @override
  State<BoatCrewProfileScreen> createState() => _CrewProfileState();
}

class _CrewProfileState extends State<BoatCrewProfileScreen> {
  Map<String, dynamic>? profile;
  final phone = TextEditingController(), bio = TextEditingController();
  bool saving = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final p = await ApiService.instance.crewProfile();
    if (mounted)
      setState(() {
        profile = p;
        phone.text = p['phoneNumber'] ?? '';
        bio.text = p['bio'] ?? '';
      });
  }

  @override
  void dispose() {
    phone.dispose();
    bio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => CrewShell(
      title: 'Profile',
      child: profile == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(22), children: [
              Center(
                  child: CircleAvatar(
                      radius: 48,
                      backgroundColor: const Color(0xFFEFF3F8),
                      child: Text('${profile!['displayName']}'.characters.first,
                          style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              color: _navy)))),
              const SizedBox(height: 12),
              Center(
                  child: Text(profile!['displayName'] ?? '',
                      style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.w800))),
              Center(
                  child: CrewStatus(
                      profile!['certified'] == true ? 'Approved' : 'Pending')),
              const SizedBox(height: 28),
              _readonly('NIC Number', profile!['nicNumber'] ?? '',
                  Icons.badge_outlined),
              _readonly('Email', profile!['email'] ?? '', Icons.mail_outline),
              TextField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                      labelText: 'Phone Number',
                      prefixIcon: Icon(Icons.phone_outlined))),
              const SizedBox(height: 14),
              TextField(
                  controller: bio,
                  maxLines: 4,
                  decoration: const InputDecoration(
                      labelText: 'About',
                      prefixIcon: Icon(Icons.notes_rounded))),
              const SizedBox(height: 22),
              ElevatedButton.icon(
                  onPressed: saving ? null : _save,
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Update Profile'))
            ]));
  Widget _readonly(String l, String v, IconData i) => Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
          readOnly: true,
          controller: TextEditingController(text: v),
          decoration: InputDecoration(labelText: l, prefixIcon: Icon(i))));
  Future<void> _save() async {
    setState(() => saving = true);
    try {
      profile = await ApiService.instance.updateCrewProfile(
          email: profile!['email'],
          phoneNumber: phone.text.trim(),
          bio: bio.text.trim());
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile updated successfully.')));
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_error(e))));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }
}

class BoatCrewNotificationsScreen extends StatelessWidget {
  const BoatCrewNotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) => CrewShell(
      title: 'Notifications',
      child: FutureBuilder<List<Map<String, dynamic>>>(
          future: ApiService.instance.trips(),
          builder: (context, s) {
            if (!s.hasData)
              return const Center(child: CircularProgressIndicator());
            final rows = s.data!;
            return rows.isEmpty
                ? const _EmptyCard(
                    'No notifications yet.', Icons.notifications_none)
                : ListView.separated(
                    padding: const EdgeInsets.all(18),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final t = rows[i];
                      return Card(
                          child: ListTile(
                              leading: CircleAvatar(
                                  backgroundColor: _navy.withValues(alpha: .1),
                                  child: const Icon(Icons.directions_boat,
                                      color: _navy)),
                              title: Text('${t['vesselName']} · ${t['status']}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700)),
                              subtitle: Text(
                                  'Shore approval: ${t['shoreApproval']}\n${_date(t['updatedAtUtc'])}'),
                              isThreeLine: true));
                    });
          }));
}

class BoatCrewSettingsScreen extends StatelessWidget {
  const BoatCrewSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) => CrewShell(
      title: 'Settings',
      child: ListView(padding: const EdgeInsets.all(18), children: [
        const _SettingsHeader(),
        Card(
            child: Column(children: [
          ListTile(
              leading: const Icon(Icons.lock_outline),
              title: const Text('Password'),
              subtitle: const Text('Update your account password'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _password(context)),
          const Divider(height: 1),
          const ListTile(
              leading: Icon(Icons.language),
              title: Text('Language'),
              subtitle: Text('English'),
              trailing: Icon(Icons.chevron_right)),
          const Divider(height: 1),
          const ListTile(
              leading: Icon(Icons.help_outline),
              title: Text('Need Help?'),
              subtitle: Text('Contact the WWMS support centre'))
        ])),
        const SizedBox(height: 18),
        OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                minimumSize: const Size.fromHeight(50)),
            onPressed: () async {
              await ApiService.instance.logout();
              if (context.mounted)
                Navigator.pushNamedAndRemoveUntil(
                    context, '/login', (_) => false);
            },
            icon: const Icon(Icons.logout),
            label: const Text('Log Out'))
      ]));
  static Future<void> _password(BuildContext context) async {
    final current = TextEditingController(),
        next = TextEditingController(),
        confirm = TextEditingController();
    await showDialog(
        context: context,
        builder: (d) => AlertDialog(
                title: const Text('Change Password'),
                content: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                      controller: current,
                      obscureText: true,
                      decoration:
                          const InputDecoration(labelText: 'Current password')),
                  const SizedBox(height: 10),
                  TextField(
                      controller: next,
                      obscureText: true,
                      decoration:
                          const InputDecoration(labelText: 'New password')),
                  const SizedBox(height: 10),
                  TextField(
                      controller: confirm,
                      obscureText: true,
                      decoration:
                          const InputDecoration(labelText: 'Confirm password'))
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(d),
                      child: const Text('Cancel')),
                  ElevatedButton(
                      onPressed: () async {
                        if (next.text != confirm.text || next.text.length < 12)
                          return;
                        await ApiService.instance
                            .changePassword(current.text, next.text);
                        if (d.mounted) Navigator.pop(d);
                      },
                      child: const Text('Update'))
                ]));
  }
}

class _SettingsHeader extends StatelessWidget {
  const _SettingsHeader();
  @override
  Widget build(BuildContext context) => const Padding(
      padding: EdgeInsets.only(bottom: 18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Account Settings',
            style: TextStyle(
                fontSize: 24, fontWeight: FontWeight.w800, color: _ink)),
        Text('Manage your crew portal preferences.',
            style: TextStyle(color: Colors.blueGrey))
      ]));
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.text, this.icon);
  final String text;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(
      child: Padding(
          padding: const EdgeInsets.all(34),
          child: Column(children: [
            Icon(icon, size: 42, color: Colors.blueGrey),
            const SizedBox(height: 10),
            Text(text,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.blueGrey))
          ])));
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard(this.text, this.retry);
  final String text;
  final Future<void> Function() retry;
  @override
  Widget build(BuildContext context) => Center(
      child: Card(
          child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.cloud_off, color: Colors.red, size: 42),
                const SizedBox(height: 10),
                Text(text, textAlign: TextAlign.center),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                    onPressed: retry,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Try Again'))
              ]))));
}

String _date(dynamic value) {
  final d = DateTime.tryParse('$value')?.toLocal();
  if (d == null) return 'Schedule unavailable';
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final period = d.hour >= 12 ? 'PM' : 'AM';
  return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} · $hour:${d.minute.toString().padLeft(2, '0')} $period';
}

String _error(Object e) =>
    e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');

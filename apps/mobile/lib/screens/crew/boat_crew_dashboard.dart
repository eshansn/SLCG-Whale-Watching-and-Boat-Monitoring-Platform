import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../services/api_service.dart';
import '../../widgets/mobile_search_field.dart';
import '../../widgets/owner_layout.dart';
import '../owner/owner_portal_common.dart';

class CrewShell extends StatelessWidget {
  const CrewShell({
    super.key,
    required this.child,
    this.title,
    this.active = 'dashboard',
    this.darkHeader = false,
  });
  final Widget child;
  final String? title;
  final String active;
  final bool darkHeader;

  @override
  Widget build(BuildContext context) => Scaffold(
        extendBodyBehindAppBar: darkHeader,
        backgroundColor: ownerCanvas,
        appBar: AppBar(
          backgroundColor: darkHeader ? Colors.transparent : Colors.white,
          foregroundColor: darkHeader ? Colors.white : ownerInk,
          surfaceTintColor: Colors.transparent,
          shadowColor: Colors.transparent,
          scrolledUnderElevation: 0,
          flexibleSpace: darkHeader
              ? ClipRect(
                  child: BackdropFilter(
                    filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Color(0x4D061326),
                        border: Border(
                          bottom: BorderSide(color: Color(0x2EFFFFFF)),
                        ),
                      ),
                    ),
                  ),
                )
              : null,
          elevation: 0,
          leading: IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_none_rounded, size: 27),
            onPressed: () {
              if (ModalRoute.of(context)?.settings.name !=
                  '/crew_notifications') {
                Navigator.pushNamed(context, '/crew_notifications');
              }
            },
          ),
          title: title == null
              ? null
              : Text(
                  title!,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
          actions: [
            Builder(
              builder: (drawerContext) => IconButton(
                tooltip: 'Menu',
                icon: const Icon(Icons.menu_rounded, size: 30),
                onPressed: () => Scaffold.of(drawerContext).openEndDrawer(),
              ),
            ),
          ],
        ),
        endDrawer: CrewDrawer(active: active, dark: darkHeader),
        body: SafeArea(top: false, child: child),
      );
}

class CrewDrawer extends StatelessWidget {
  const CrewDrawer({super.key, this.active = 'dashboard', this.dark = false});
  final String active;
  final bool dark;

  static const items = [
    ('dashboard', 'Dashboard', Icons.dashboard_outlined, '/boat_crew'),
    ('profile', 'Profile', Icons.person_outline, '/crew_profile'),
    ('trips', 'My Trips', Icons.sailing_outlined, '/crew_trips'),
    ('settings', 'Settings', Icons.settings_outlined, '/crew_settings'),
  ];

  @override
  Widget build(BuildContext context) => Drawer(
        width: 310,
        backgroundColor: dark ? Colors.transparent : Colors.white,
        surfaceTintColor: Colors.transparent,
        child: SafeArea(
          child: ClipRect(
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(
                sigmaX: dark ? 20 : 0,
                sigmaY: dark ? 20 : 0,
              ),
              child: ColoredBox(
                color: dark ? const Color(0xC20A1B2E) : Colors.transparent,
                child: Column(
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: IconButton(
                        tooltip: 'Close menu',
                        color: dark ? Colors.white : ownerInk,
                        icon: const Icon(Icons.close_rounded, size: 28),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 18, 24, 22),
                      child: Row(
                        children: [
                          CircleAvatar(
                            backgroundColor:
                                dark ? const Color(0xFF24558B) : ownerNavy,
                            child:
                                const Icon(Icons.sailing, color: Colors.white),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Boat Crew',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w700,
                              color: dark ? Colors.white : ownerInk,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ...items.map((item) {
                      final selected = active == item.$1;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: ListTile(
                          selected: selected,
                          iconColor: dark ? const Color(0xFFC8D9EA) : null,
                          textColor: dark ? const Color(0xFFEAF2FB) : null,
                          selectedTileColor: dark
                              ? const Color(0xFF1D4773)
                              : const Color(0xFFF1F5F9),
                          selectedColor: dark ? Colors.white : ownerNavy,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          leading: Icon(item.$3),
                          title: Text(
                            item.$2,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            if (ModalRoute.of(context)?.settings.name !=
                                item.$4) {
                              Navigator.pushReplacementNamed(context, item.$4);
                            }
                          },
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}

class CrewStatus extends StatelessWidget {
  const CrewStatus(this.value, {super.key});
  final String value;
  @override
  Widget build(BuildContext context) => OwnerStatusBadge(value);
}

class BoatCrewDashboard extends StatefulWidget {
  const BoatCrewDashboard({super.key});
  @override
  State<BoatCrewDashboard> createState() => _BoatCrewDashboardState();
}

class _BoatCrewDashboardState extends State<BoatCrewDashboard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _gradientController;
  bool loading = true;
  String? error;
  Map<String, dynamic>? profile;
  List<Map<String, dynamic>> trips = [];
  @override
  void initState() {
    super.initState();
    _gradientController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 11),
    )..repeat(reverse: true);
    _load();
    ApiService.instance.addListener(_refresh);
  }

  @override
  void dispose() {
    ApiService.instance.removeListener(_refresh);
    _gradientController.dispose();
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
      active: 'dashboard',
      darkHeader: true,
      child: AnimatedBuilder(
        animation: _gradientController,
        child: RefreshIndicator(
          onRefresh: _load,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                  16,
                  MediaQuery.paddingOf(context).top + kToolbarHeight + 18,
                  16,
                  26,
                ),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 42,
                        backgroundColor: const Color(0xFFDCE8F5),
                        child: Text(
                          (profile?['displayName']?.toString() ?? 'C')
                              .characters
                              .first,
                          style: const TextStyle(
                            color: ownerNavy,
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Welcome Back',
                                style: TextStyle(
                                    fontSize: 11, color: Color(0xFFBFD2E8))),
                            Text(
                              profile?['displayName']?.toString() ??
                                  'Crew Member',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (loading)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 100),
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  ),
                )
              else if (error != null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: OwnerErrorPanel(message: error!, retry: _load),
                  ),
                )
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 22),
                  sliver: SliverToBoxAdapter(
                    child: ongoing == null ? _navyEmpty() : _ongoing(ongoing),
                  ),
                ),
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF9FAFC),
                      borderRadius:
                          BorderRadius.vertical(top: Radius.circular(26)),
                    ),
                    padding: const EdgeInsets.fromLTRB(18, 24, 18, 42),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Upcoming Trips',
                                style: TextStyle(
                                  color: ownerInk,
                                  fontSize: 21,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: () =>
                                  Navigator.pushNamed(context, '/crew_trips'),
                              child: const Text('See all'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        if (upcoming.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 20),
                            child: Text(
                              'No upcoming trips assigned.',
                              style: TextStyle(color: ownerMuted),
                            ),
                          ),
                        if (upcoming.isNotEmpty) ...upcoming.map(_tripCard),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        builder: (context, child) {
          final progress =
              Curves.easeInOut.transform(_gradientController.value);
          return Stack(
            fit: StackFit.expand,
            children: [
              Image.asset(
                'assets/images/bg_whale_boat.jpg',
                fit: BoxFit.cover,
                alignment: Alignment.center,
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment(-1.45 + (progress * 1.15), -1.05),
                    end: Alignment(1.35 - (progress * .85), 1.1),
                    colors: const [
                      Color(0xF201050C),
                      Color(0xE3030D1B),
                      Color(0xCF071B31),
                      Color(0xBD0B2948),
                    ],
                    stops: [
                      0,
                      .24 + (progress * .12),
                      .63 - (progress * .08),
                      1,
                    ],
                    transform: GradientRotation((progress - .5) * .16),
                  ),
                ),
              ),
              if (child != null) child,
            ],
          );
        },
      ),
    );
  }

  Widget _navyEmpty() => Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF101D3B), ownerNavy, Color(0xFF24558B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [
            BoxShadow(
                color: Color(0x3D000000), blurRadius: 15, offset: Offset(0, 7)),
          ]),
      child:
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.sailing, color: Colors.white),
        SizedBox(height: 20),
        Text('No ongoing trip',
            style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 18)),
        Text('Your active assignment will appear here.',
            style: TextStyle(color: Colors.white70, fontSize: 12))
      ]));
  Widget _ongoing(Map<String, dynamic> t) => InkWell(
      onTap: () => _open(t),
      borderRadius: BorderRadius.circular(20),
      child: Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
              gradient: const LinearGradient(
                  colors: [Color(0xFF075AEE), Color(0xFF12348C)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x3D000000),
                    blurRadius: 15,
                    offset: Offset(0, 7))
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
  Widget _tripCard(Map<String, dynamic> t) => Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: OwnerCard(
          child: Row(children: [
        Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
                color: const Color(0xFFDCE8F5),
                borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.directions_boat_outlined,
                color: ownerNavy, size: 30)),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t['vesselName'] ?? 'Vessel',
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          Text(_date(t['scheduledDepartureUtc']),
              style: const TextStyle(color: ownerMuted, fontSize: 11)),
          const SizedBox(height: 8),
          CrewStatus(t['shoreApproval'] ?? 'Pending')
        ])),
        IconButton(
          tooltip: 'View trip',
          color: ownerInk,
          icon: const Icon(Icons.info_outline_rounded),
          onPressed: () => _open(t),
        ),
      ])));
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
      active: 'trips',
      title: 'My Trips',
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
          children: [
            const Text('My Trips',
                style: TextStyle(fontSize: 23, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Review your assigned vessel departures.',
                style: TextStyle(color: ownerMuted)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (value) => setState(() => query = value),
                    style: mobileSearchTextStyle,
                    decoration: mobileSearchDecoration('Search'),
                  ),
                ),
                const SizedBox(width: 10),
                DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: sort,
                    borderRadius: BorderRadius.circular(10),
                    onChanged: (value) => setState(() => sort = value ?? sort),
                    items: const [
                      DropdownMenuItem(value: 'name', child: Text('Name')),
                      DropdownMenuItem(value: 'time', child: Text('Time')),
                      DropdownMenuItem(value: 'status', child: Text('Status')),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (rows.isEmpty)
              OwnerEmptyPanel(
                title: query.isEmpty ? 'No trips assigned' : 'No trips found',
                message: query.isEmpty
                    ? 'Your assigned trips will appear here.'
                    : 'Try a different vessel, registration, or status.',
                icon: query.isEmpty
                    ? Icons.calendar_month_outlined
                    : Icons.search_off_rounded,
              )
            else
              ...rows.map((trip) => _CrewTripCard(
                    trip: trip,
                    onTap: () => Navigator.pushNamed(
                      context,
                      '/crew_trip_info',
                      arguments: trip['id'],
                    ),
                  )),
          ],
        ),
      ),
    );
  }
}

class _CrewTripCard extends StatelessWidget {
  const _CrewTripCard({required this.trip, required this.onTap});
  final Map<String, dynamic> trip;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: OwnerCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const CircleAvatar(
                    backgroundColor: Color(0xFFDCE8F5),
                    foregroundColor: ownerNavy,
                    child: Icon(Icons.sailing_rounded),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${trip['vesselName']}',
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w700)),
                        Text('${trip['registrationNumber']}',
                            style: const TextStyle(color: ownerMuted)),
                      ],
                    ),
                  ),
                  CrewStatus(trip['shoreApproval'] ?? 'Pending'),
                ],
              ),
              const SizedBox(height: 16),
              _line('Scheduled', _date(trip['scheduledDepartureUtc'])),
              _line('Trip status', '${trip['status']}'),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: onTap,
                  child: const Text('Info'),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _line(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 90,
              child: Text(label,
                  style: const TextStyle(
                      color: ownerMuted, fontWeight: FontWeight.w600)),
            ),
            Expanded(child: Text(value)),
          ],
        ),
      );
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
  bool startBusy = false;
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
    if (loading) {
      return const CrewShell(
          active: 'trips',
          title: 'Trip Info',
          child: Center(child: CircularProgressIndicator()));
    }
    if (error != null) {
      return CrewShell(
        active: 'trips',
        title: 'Trip Info',
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [OwnerErrorPanel(message: error!, retry: _load)],
        ),
      );
    }
    final summary =
        (attendance?['summary'] as Map?)?.cast<String, dynamic>() ?? {};
    final isOngoing = trip!['status'] == 'Ongoing';
    return CrewShell(
      active: 'trips',
      title: 'Trip Info',
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
          children: [
            OwnerCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(trip!['vesselName'] ?? '',
                            style: const TextStyle(
                                fontSize: 21, fontWeight: FontWeight.w700)),
                        Text(trip!['registrationNumber'] ?? '',
                            style: const TextStyle(color: ownerMuted)),
                        const SizedBox(height: 12),
                        Text(_date(trip!['scheduledDepartureUtc'])),
                        const SizedBox(height: 8),
                        CrewStatus(trip!['shoreApproval'] ?? 'Pending'),
                      ],
                    ),
                  ),
                  if (trip!['invitationCode'] != null)
                    QrImageView(data: trip!['invitationCode'], size: 110),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (trip!['status'] == 'Scheduled' ||
                trip!['status'] == 'Boarding' ||
                isOngoing) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: startBusy ? null : _startTrip,
                  icon: startBusy
                      ? const SizedBox(
                          width: 17,
                          height: 17,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(isOngoing
                          ? Icons.stop_rounded
                          : Icons.play_arrow_rounded),
                  label: Text(startBusy
                      ? (isOngoing ? 'Ending...' : 'Starting...')
                      : (isOngoing ? 'End Trip' : 'Start Trip')),
                ),
              ),
              const SizedBox(height: 16),
            ],
            OwnerCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Passenger Attendance',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  Row(children: [
                    _count('Present', summary['present'] ?? 0,
                        const Color(0xFF059669)),
                    _count('Absent', summary['notPresent'] ?? 0,
                        const Color(0xFFDC2626)),
                    _count('Not checked', summary['notChecked'] ?? 0,
                        const Color(0xFFD97706)),
                  ]),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OwnerCard(
                padding: EdgeInsets.zero,
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
                              child: Text('No passengers registered yet.',
                                  style: TextStyle(color: ownerMuted))),
                        ...passengers.map((person) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const CircleAvatar(
                                  backgroundColor: Color(0xFFDCE8F5),
                                  foregroundColor: ownerNavy,
                                  child: Icon(Icons.person_outline)),
                              title: Text(person['name'] ?? '',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                  '${person['identificationNumber'] ?? ''} · ${person['passengerType'] ?? ''}'),
                            )),
                      ],
                    ))),
            const SizedBox(height: 16),
            FilledButton.icon(
              style: FilledButton.styleFrom(
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
                fontSize: 23, fontWeight: FontWeight.w700, color: color)),
        Text(label, style: const TextStyle(fontSize: 10, color: ownerMuted)),
      ]));

  Future<void> _startTrip() async {
    if (id == null || startBusy) return;
    final isOngoing = trip?['status'] == 'Ongoing';
    setState(() => startBusy = true);
    try {
      await ApiService.instance
          .updateStatus(id!, isOngoing ? 'Completed' : 'Ongoing');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(isOngoing
                ? 'Trip ended successfully.'
                : 'Trip started successfully.')));
      }
    } catch (exception) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_error(exception))));
      }
    } finally {
      if (mounted) setState(() => startBusy = false);
    }
  }

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
        active: 'profile',
        title: 'Profile',
        child: profile == null
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
                  children: [
                    OwnerCard(
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 42,
                            backgroundColor: const Color(0xFFDCE8F5),
                            child: Text(
                              '${profile!['displayName']}'.characters.first,
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w700,
                                color: ownerNavy,
                              ),
                            ),
                          ),
                          const SizedBox(width: 18),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(profile!['displayName'] ?? '',
                                    style: const TextStyle(
                                        fontSize: 21,
                                        fontWeight: FontWeight.w700)),
                                const SizedBox(height: 7),
                                CrewStatus(profile!['certified'] == true
                                    ? 'Approved'
                                    : 'Pending'),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    OwnerCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('NIC Number'),
                          _readonly(profile!['nicNumber'] ?? '',
                              Icons.badge_outlined),
                          _label('Email'),
                          _readonly(
                              profile!['email'] ?? '', Icons.mail_outline),
                          _label('Phone Number'),
                          TextField(
                            controller: phone,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                                prefixIcon: Icon(Icons.phone_outlined)),
                          ),
                          _label('About'),
                          TextField(
                            controller: bio,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              hintText: 'Add a short biography',
                              prefixIcon: Icon(Icons.notes_rounded),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 22),
                    FilledButton(
                      onPressed: saving ? null : _save,
                      child: Text(saving ? 'Updating...' : 'Update'),
                    ),
                  ],
                ),
              ),
      );

  Widget _label(String value) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 7),
        child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      );

  Widget _readonly(String value, IconData icon) => InputDecorator(
        decoration: InputDecoration(filled: true, prefixIcon: Icon(icon)),
        child: Text(value),
      );
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
                ? ListView(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
                    children: const [
                      OwnerEmptyPanel(
                        title: 'No notifications yet',
                        message: 'Your trip updates will appear here.',
                        icon: Icons.notifications_none_rounded,
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (_, i) {
                      final t = rows[i];
                      return OwnerCard(
                          padding: EdgeInsets.zero,
                          child: ListTile(
                              leading: CircleAvatar(
                                  backgroundColor: const Color(0xFFDCE8F5),
                                  child: const Icon(Icons.directions_boat,
                                      color: ownerNavy)),
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
        active: 'settings',
        title: 'Settings',
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
          children: [
            const Text('Settings',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Manage your Boat Crew portal preferences.',
                style: TextStyle(color: ownerMuted)),
            const SizedBox(height: 20),
            OwnerCard(
              child: Column(
                children: [
                  _action(
                    'Password',
                    'Update your account password',
                    Icons.lock_outline_rounded,
                    () => _password(context),
                  ),
                  const Divider(height: 30),
                  _action(
                    'Language',
                    'English',
                    Icons.language_rounded,
                    null,
                  ),
                  const Divider(height: 30),
                  _action(
                    'Need Help?',
                    'Contact the WWMS support centre',
                    Icons.help_outline_rounded,
                    null,
                  ),
                  const Divider(height: 30),
                  _action(
                    'Log Out',
                    'Log Out From WWMS',
                    Icons.logout_rounded,
                    () async {
                      await ApiService.instance.logout();
                      if (context.mounted) {
                        Navigator.pushNamedAndRemoveUntil(
                            context, '/login', (_) => false);
                      }
                    },
                    destructive: true,
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  static Widget _action(
    String title,
    String subtitle,
    IconData icon,
    VoidCallback? tap, {
    bool destructive = false,
  }) =>
      InkWell(
        onTap: tap,
        child: Row(
          children: [
            Icon(icon, color: destructive ? Colors.red : ownerNavy),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: destructive ? Colors.red : ownerInk)),
                  Text(subtitle,
                      style: const TextStyle(color: ownerMuted, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      );
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
                  FilledButton(
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

String _date(dynamic value) {
  final d = DateTime.tryParse('$value')?.toLocal();
  if (d == null) return 'Schedule unavailable';
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final period = d.hour >= 12 ? 'PM' : 'AM';
  return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} · $hour:${d.minute.toString().padLeft(2, '0')} $period';
}

String _error(Object e) =>
    e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';

class OwnerNewTripScreen extends StatefulWidget {
  const OwnerNewTripScreen({super.key});
  @override
  State<OwnerNewTripScreen> createState() => _State();
}

class _State extends State<OwnerNewTripScreen> {
  final destination = TextEditingController(),
      capacity = TextEditingController();
  List<Map<String, dynamic>> boats = [];
  String? boatId;
  String? loadError;
  bool loading = true, saving = false;
  DateTime departure = DateTime.now().add(const Duration(days: 1)),
      returnTime = DateTime.now().add(const Duration(days: 1, hours: 5));

  @override
  void initState() {
    super.initState();
    _loadBoats();
  }

  Future<void> _loadBoats() async {
    try {
      final data = await ApiService.instance.boats();
      if (!mounted) return;
      setState(() {
        boats = data
            .where((boat) => boat['approval']?.toString() == 'Approved')
            .toList();
        boatId = boats.firstOrNull?['id']?.toString();
        loadError = null;
        loading = false;
      });
    } catch (exception) {
      if (!mounted) return;
      setState(() {
        loadError = exception.toString().replaceFirst('Exception: ', '');
        loading = false;
      });
    }
  }

  @override
  void dispose() {
    destination.dispose();
    capacity.dispose();
    super.dispose();
  }

  Future<void> pick(bool returning) async {
    final date = await showDatePicker(
        context: context,
        firstDate: DateTime.now(),
        lastDate: DateTime.now().add(const Duration(days: 365)),
        initialDate: returning ? returnTime : departure);
    if (date == null || !mounted) return;
    final time = await showTimePicker(
        context: context,
        initialTime:
            TimeOfDay.fromDateTime(returning ? returnTime : departure));
    if (time == null) return;
    setState(() {
      final value =
          DateTime(date.year, date.month, date.day, time.hour, time.minute);
      if (returning) {
        returnTime = value;
      } else {
        departure = value;
      }
    });
  }

  Future<void> save() async {
    final cap = int.tryParse(capacity.text);
    if (boatId == null ||
        destination.text.trim().isEmpty ||
        cap == null ||
        cap <= 0 ||
        returnTime.isBefore(departure)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Enter a valid vessel, schedule, destination and capacity.')));
      return;
    }
    final boat = boats.firstWhere((item) => item['id']?.toString() == boatId);
    final maximumCapacity = boat['maximumCapacity'] as int? ?? 0;
    if (cap > maximumCapacity) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Capacity cannot exceed $maximumCapacity.')));
      return;
    }
    setState(() => saving = true);
    try {
      await ApiService.instance.createTrip(boatId!, departure,
          route: destination.text.trim(), passengerCount: cap);
      if (mounted) Navigator.pop(context, true);
    } catch (exception) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(exception.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
        child: Column(children: [
      Expanded(
          child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (loading)
                      const Center(child: CircularProgressIndicator())
                    else if (loadError != null) ...[
                      Text(loadError!,
                          style: const TextStyle(color: Colors.red)),
                      TextButton.icon(
                          onPressed: _loadBoats,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Try Again'))
                    ],
                    label('Select A Certified Vessel'),
                    box(DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                            isExpanded: true,
                            value: boatId,
                            items: boats
                                .map((b) => DropdownMenuItem(
                                    value: b['id']?.toString(),
                                    child: Text(b['name']?.toString() ??
                                        'Unnamed boat')))
                                .toList(),
                            onChanged: (v) => setState(() => boatId = v)))),
                    label('Departure Date & Time'),
                    dateBox(departure, () => pick(false)),
                    label('Estimated Return'),
                    dateBox(returnTime, () => pick(true)),
                    label('Destination'),
                    TextField(
                        controller: destination,
                        decoration: input('Dondra Head')),
                    label('Passenger Capacity'),
                    TextField(
                        controller: capacity,
                        keyboardType: TextInputType.number,
                        decoration: input('30')),
                    if (!loading && boats.isEmpty)
                      const Padding(
                          padding: EdgeInsets.only(top: 16),
                          child: Text('No certified boats are available.',
                              style: TextStyle(color: Colors.red)))
                  ]))),
      Padding(
          padding: const EdgeInsets.all(24),
          child: SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F172A),
                      foregroundColor: Colors.white),
                  onPressed: boats.isEmpty || saving ? null : save,
                  child: const Text('Schedule Trip'))))
    ]));
  }

  Widget label(String t) => Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 8),
      child: Text(t, style: const TextStyle(fontWeight: FontWeight.bold)));
  Widget box(Widget c) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(12)),
      child: c);
  Widget dateBox(DateTime d, VoidCallback tap) => InkWell(
      onTap: tap,
      child: box(Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(d.toLocal().toString()),
                const Icon(Icons.calendar_today_outlined)
              ]))));
  InputDecoration input(String hint) => InputDecoration(
      hintText: hint,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)));
}

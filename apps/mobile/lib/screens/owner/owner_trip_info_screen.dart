import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../owner/owner_store.dart';
import '../../widgets/owner_layout.dart';

class OwnerTripInfoScreen extends StatefulWidget {
  const OwnerTripInfoScreen({super.key});
  @override
  State<OwnerTripInfoScreen> createState() => _State();
}

class _State extends State<OwnerTripInfoScreen> {
  final store = OwnerStore.instance, search = TextEditingController();
  String? id;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    id ??= ModalRoute.of(context)?.settings.arguments as String?;
    store.addListener(refresh);
    store.refresh();
  }

  @override
  void dispose() {
    store.removeListener(refresh);
    search.dispose();
    super.dispose();
  }

  void refresh() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final trip = id == null ? null : store.trip(id!);
    if (trip == null)
      return const OwnerLayout(child: Center(child: Text('Trip not found.')));
    final boat = store.boat(trip.boatId)!;
    final q = search.text.toLowerCase();
    final passengers = trip.passengers
        .where((p) =>
            p.name.toLowerCase().contains(q) ||
            p.nicOrPassport.toLowerCase().contains(q))
        .toList();
    final overall = trip.approved
        ? 'Approved'
        : trip.shoreApproval == 'Rejected' ||
                trip.wildlifeApproval == 'Rejected'
            ? 'Rejected'
            : 'Pending Approval';
    return OwnerLayout(
        title: 'Trip Details',
        child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              card(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(boat.name,
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold)),
                    info('Registration', boat.registrationNumber),
                    info('Departure', trip.departure.toString()),
                    info('Estimated Return', trip.returnTime.toString()),
                    info('Destination', trip.destination),
                    info('Current Status', trip.status.name),
                    info('Passenger Count',
                        '${trip.passengers.length}/${trip.passengerCapacity}'),
                    info('Shore Officer', trip.shoreApproval),
                    info('Wildlife Officer', trip.wildlifeApproval),
                    info('Overall Approval', overall)
                  ])),
              const SizedBox(height: 16),
              card(Column(children: [
                QrImageView(data: trip.qrToken, size: 180),
                Text(trip.qrToken),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  TextButton(
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: trip.qrToken));
                        ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('QR value copied.')));
                      },
                      child: const Text('Download / Copy')),
                  TextButton(
                      onPressed: () => Navigator.pushNamed(
                          context, '/trip-register',
                          arguments: trip.qrToken),
                      child: const Text('Open Registration'))
                ])
              ])),
              const SizedBox(height: 16),
              card(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Live Map',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                    Container(
                        height: 180,
                        color: Colors.blueGrey.shade100,
                        child: Center(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              const Icon(Icons.location_on,
                                  size: 48, color: Colors.red),
                              Text(
                                  '${trip.latitude.toStringAsFixed(6)}, ${trip.longitude.toStringAsFixed(6)}')
                            ])))
                  ])),
              const SizedBox(height: 16),
              TextField(
                  controller: search,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Search passengers')),
              const SizedBox(height: 8),
              card(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Registered Passengers',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                    if (passengers.isEmpty)
                      const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('No passengers registered yet.')),
                    ...passengers.map((p) => ListTile(
                        title: Text(p.name),
                        subtitle: Text(
                            '${p.nicOrPassport} · ${p.nationality}\nRegistered ${p.registeredAt}'),
                        onTap: () => showDialog(
                            context: context,
                            builder: (d) => AlertDialog(
                                    title: Text(p.name),
                                    content: Text(
                                        '${p.nicOrPassport}\n${p.phone}\n${p.nationality}\nEmergency: ${p.emergencyContact}'),
                                    actions: [
                                      TextButton(
                                          onPressed: () => Navigator.pop(d),
                                          child: const Text('Close'))
                                    ]))))
                  ]))
            ])));
  }

  Widget card(Widget child) => Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200)),
      child: child);
  Widget info(String l, String v) => Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(l, style: const TextStyle(fontWeight: FontWeight.bold)),
        Flexible(child: Text(v, textAlign: TextAlign.right))
      ]));
}

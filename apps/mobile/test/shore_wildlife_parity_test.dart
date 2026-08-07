import 'package:flutter_test/flutter_test.dart';
import 'package:wwms_app/screens/shore_wildlife/shore_wildlife_common.dart';

void main() {
  final trips = <Map<String, dynamic>>[
    {
      'boatName': 'Sea Pearl',
      'registrationNumber': 'SL-WB-2',
      'ownerName': 'Nimal',
      'route': 'Dondra Head',
      'status': 'Scheduled',
      'wildlifeShoreApproval': 'Pending',
      'scheduledDepartureUtc': '2026-08-02T02:00:00Z',
    },
    {
      'boatName': 'Ocean Star',
      'registrationNumber': 'SL-WB-1',
      'ownerName': 'Amal',
      'route': 'Mirissa',
      'status': 'Completed',
      'wildlifeShoreApproval': 'Approved',
      'scheduledDepartureUtc': '2026-08-01T02:00:00Z',
    },
  ];

  test('trip search matches every field used by the web portal', () {
    for (final query in [
      'Ocean',
      'SL-WB-1',
      'Amal',
      'Mirissa',
      'Completed',
      'Approved',
    ]) {
      expect(visibleWildlifeTrips(trips, query, 'newest').single['boatName'],
          'Ocean Star');
    }
  });

  test('trip sorting matches all four web sort options', () {
    expect(visibleWildlifeTrips(trips, '', 'newest').first['boatName'],
        'Sea Pearl');
    expect(visibleWildlifeTrips(trips, '', 'oldest').first['boatName'],
        'Ocean Star');
    expect(visibleWildlifeTrips(trips, '', 'name').first['boatName'],
        'Ocean Star');
    expect(visibleWildlifeTrips(trips, '', 'approval').first['boatName'],
        'Ocean Star');
  });

  test('boat approval aggregation matches the web portal', () {
    expect(
      wildlifeBoatApproval({
        'certificationApproval': 'Approved',
        'boatWildlifeApproval': 'Pending',
      }),
      'Approved',
    );
    expect(
      wildlifeBoatApproval({
        'certificationApproval': 'Pending',
        'boatWildlifeApproval': 'Approved',
      }),
      'Approved',
    );
    expect(
      wildlifeBoatApproval({
        'certificationApproval': 'Rejected',
        'boatWildlifeApproval': 'Rejected',
      }),
      'Rejected',
    );
    expect(
      wildlifeBoatApproval({
        'certificationApproval': 'Rejected',
        'boatWildlifeApproval': 'Pending',
      }),
      'Pending',
    );
  });

  test('new monitoring records are created and then requested for signatures',
      () async {
    final calls = <String>[];
    final result = await requestWildlifeSignatureWorkflow(
      tripId: 'trip-1',
      fields: {'ticketNumber': 'T-1'},
      existingRecord: null,
      create: (body) async {
        calls.add('create:${body['tripId']}');
        return {'id': 'record-1', 'status': 'Draft'};
      },
      update: (id, body) async {
        calls.add('update:$id:${body['ticketNumber']}');
        return {'id': id, 'status': 'PendingHarbourSignature'};
      },
    );

    expect(calls, ['create:trip-1', 'update:record-1:T-1']);
    expect(result['status'], 'PendingHarbourSignature');
  });

  test('existing monitoring records skip creation', () async {
    var created = false;
    await requestWildlifeSignatureWorkflow(
      tripId: 'trip-1',
      fields: const {'ticketNumber': 'T-2'},
      existingRecord: const {'id': 'record-2', 'status': 'Draft'},
      create: (_) async {
        created = true;
        return {};
      },
      update: (id, body) async => {'id': id, ...body},
    );
    expect(created, isFalse);
  });

  test('signature completion requires all signatures and harbour officer', () {
    final record = {
      'monitoringOfficerSignature': 'data:image/png;base64,a',
      'supervisorSignature': 'data:image/png;base64,b',
      'harbourOfficerSignature': 'data:image/png;base64,c',
      'harbourOfficerName': 'Officer',
    };
    expect(wildlifeSignaturesComplete(record), isTrue);
    record['harbourOfficerName'] = '';
    expect(wildlifeSignaturesComplete(record), isFalse);
  });

  test('record export strips signature data like the web portal', () {
    final exported = wildlifeRecordForExport({
      'ticketNumber': 'T-1',
      'monitoringOfficerSignature': 'large-data-1',
      'supervisorSignature': 'large-data-2',
      'harbourOfficerSignature': 'large-data-3',
    });
    expect(exported['ticketNumber'], 'T-1');
    expect(exported['monitoringOfficerSignature'], '[signature stored]');
    expect(exported['supervisorSignature'], '[signature stored]');
    expect(exported['harbourOfficerSignature'], '[signature stored]');
  });
}

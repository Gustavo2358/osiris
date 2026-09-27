       IDENTIFICATION DIVISION.
       PROGRAM-ID. ORDER-ROUTER.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-SERVICE PIC X(8).
       01 WS-CHANNEL PIC X.
       01 WS-STATUS PIC X.
       PROCEDURE DIVISION.
       MAIN.
           MOVE 'STANDARD' TO WS-SERVICE.
           IF WS-CHANNEL = 'W'
               MOVE 'WEBORDER' TO WS-SERVICE
           ELSE
               MOVE 'BRANCH' TO WS-SERVICE
           END-IF.
           PERFORM VALIDATE-ORDER.
           CALL WS-SERVICE.
           IF WS-STATUS = 'E'
               GO TO HANDLE-ERROR
           END-IF.
           CALL 'AUDITLOG'.
           GO TO FINISH.
       VALIDATE-ORDER.
           MOVE 'Y' TO WS-STATUS.
       HANDLE-ERROR.
           CALL 'ERRLOG'.
           GO TO FINISH.
       FINISH.
           GOBACK.

import com.fasterxml.jackson.databind.*;
import io.github.gustavo2358.air.model.Control;
import io.github.gustavo2358.air.model.Ids.*;
import io.github.gustavo2358.analysis.adapters.*;
import io.github.gustavo2358.analysis.query.*;
import io.github.gustavo2358.analysis.storage.StorageSubject;
import java.nio.file.*;
import java.util.*;

/** Batch public regional queries. No transfers or kill rules are implemented here. */
public final class ExportValueFlow {
    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("ExportValueFlow <air> <plan> <regional-result>");
        var output = Path.of(args[2]);
        if (Files.exists(output)) throw new IllegalArgumentException("Use a fresh output path");
        var publication = DataflowAirReader.forPartialAnalysis().read(Path.of(args[0])).publication();
        var plan = new ObjectMapper().readTree(Path.of(args[1]).toFile());
        var queries = new ArrayList<PointQuery<StorageSubject>>();
        for (var q : plan) {
            var e = q.get("point").get("entryId");
            if (!e.get("publication").asText().equals(publication.id().localId())) throw new IllegalArgumentException("Publication mismatch");
            var unit = new UnitId(publication.id(), e.get("unit").asText());
            var entry = new EntryId(unit, e.get("localId").asText());
            var p = q.get("point");
            var kind = ProgramPoint.Kind.valueOf(p.get("position").asText());
            var operation = kind == ProgramPoint.Kind.ENTRY ? null : new OperationId(unit,p.get("operationId").get("localId").asText());
            Control.OutcomeKey outcome = null;
            if (kind == ProgramPoint.Kind.AFTER) outcome = Control.NormalOutcome.INSTANCE;
            if (kind == ProgramPoint.Kind.OUTCOME) outcome = switch(p.get("outcome").get("kind").asText()) {
                case "normal" -> Control.NormalOutcome.INSTANCE;
                case "exception" -> new Control.ExceptionOutcome(p.get("outcome").get("tag").asText());
                case "other-exception" -> Control.OtherExceptionOutcome.INSTANCE;
                case "halt" -> Control.HaltOutcome.INSTANCE;
                case "diverge" -> Control.DivergeOutcome.INSTANCE;
                default -> throw new IllegalArgumentException("Unsupported outcome");
            };
            var s = q.get("subject").get("objectId");
            if (!s.get("publication").asText().equals(publication.id().localId()) || !s.get("unit").asText().equals(unit.localId())) throw new IllegalArgumentException("Subject scope mismatch");
            queries.add(new PointQuery<>(new ProgramPoint(entry,kind,operation,outcome),new StorageSubject.NamedObject(new ObjectId(unit,s.get("localId").asText()))));
        }
        var result = new io.github.gustavo2358.analysis.dataflow.RegionalAnalysis().preparePartial(publication,"explorer-value-flow",queries);
        try (var out = Files.newOutputStream(output,StandardOpenOption.CREATE_NEW)) { new RegionalResultJson().write(result,out); }
        System.out.println(queries.size()+" regional observations; one solver run");
    }
}
